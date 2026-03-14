use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use arboard::Clipboard;
use chrono::Utc;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tiny_http::{Header, Method, Response, Server, StatusCode};

const SERVER_ADDR: &str = "127.0.0.1:4310";
const MAX_ITEMS: usize = 200;
const REMOTE_ICON_BASE: &str =
    "https://raw.githubusercontent.com/rebehayan/pd2-myitem/main/app/public";

#[derive(Clone, Serialize)]
struct OverlayItem {
    id: String,
    r#type: String,
    display_name: String,
    quality: String,
    quantity: Option<i32>,
    is_corrupted: bool,
    thumbnail: String,
    captured_at: String,
    key_stats: Vec<String>,
    category: String,
    analysis_profile: String,
    analysis_tags: Vec<String>,
}

#[derive(Deserialize)]
struct OverlaySyncItem {
    id: String,
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    display_name: String,
    #[serde(default, alias = "displayName")]
    display_name_alias: String,
    #[serde(default)]
    quality: String,
    quantity: Option<i32>,
    #[serde(default)]
    is_corrupted: bool,
    #[serde(default, alias = "isCorrupted")]
    is_corrupted_alias: bool,
    #[serde(default)]
    thumbnail: String,
    #[serde(default)]
    captured_at: String,
    #[serde(default, alias = "capturedAt")]
    captured_at_alias: String,
    #[serde(default)]
    key_stats: Vec<String>,
    #[serde(default, alias = "keyStats")]
    key_stats_alias: Vec<String>,
    #[serde(default)]
    category: String,
    #[serde(default)]
    analysis_profile: String,
    #[serde(default, alias = "analysisProfile")]
    analysis_profile_alias: String,
    #[serde(default)]
    analysis_tags: Vec<String>,
    #[serde(default, alias = "analysisTags")]
    analysis_tags_alias: Vec<String>,
}

#[derive(Deserialize)]
struct OverlaySyncPayload {
    #[serde(default)]
    items: Vec<OverlaySyncItem>,
}

#[derive(Clone, Serialize)]
struct OverlayPayload {
    title: String,
    title_enabled: bool,
    title_size: i32,
    title_color: String,
    title_background_color: String,
    title_padding: i32,
    overlay_item_limit: i32,
    overlay_opacity: f64,
    overlay_minimal_mode: bool,
    items: Vec<OverlayItem>,
}

#[derive(Serialize)]
struct ResourceDebug {
    resource_dir: String,
    candidates: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct OverlaySettings {
    overlay_title: String,
    overlay_title_enabled: bool,
    overlay_title_size: i32,
    overlay_title_color: String,
    overlay_title_background_color: String,
    overlay_title_padding: i32,
    overlay_item_limit: i32,
    overlay_opacity: f64,
    overlay_minimal_mode: bool,
}

impl Default for OverlaySettings {
    fn default() -> Self {
        Self {
            overlay_title: "Overlay Feed".to_string(),
            overlay_title_enabled: true,
            overlay_title_size: 18,
            overlay_title_color: "#f7e6a8".to_string(),
            overlay_title_background_color: "#1c1a1a".to_string(),
            overlay_title_padding: 0,
            overlay_item_limit: 10,
            overlay_opacity: 0.8,
            overlay_minimal_mode: false,
        }
    }
}

fn sanitize_settings(mut settings: OverlaySettings) -> OverlaySettings {
    settings.overlay_item_limit = settings.overlay_item_limit.clamp(1, 50);
    settings.overlay_opacity = settings.overlay_opacity.clamp(0.1, 1.0);
    settings.overlay_title_size = settings.overlay_title_size.clamp(12, 48);
    settings.overlay_title_padding = settings.overlay_title_padding.clamp(0, 24);

    if settings.overlay_title.trim().is_empty() {
        settings.overlay_title = OverlaySettings::default().overlay_title;
    }
    if settings.overlay_title_color.trim().is_empty() {
        settings.overlay_title_color = OverlaySettings::default().overlay_title_color;
    }
    if settings.overlay_title_background_color.trim().is_empty() {
        settings.overlay_title_background_color =
            OverlaySettings::default().overlay_title_background_color;
    }

    settings
}

struct SharedState {
    items: Vec<OverlayItem>,
    last_hash: u64,
    settings: OverlaySettings,
    settings_path: PathBuf,
}

fn unique_image_map() -> &'static HashMap<String, String> {
    static UNIQUE_MAP: OnceLock<HashMap<String, String>> = OnceLock::new();
    UNIQUE_MAP.get_or_init(|| {
        let raw = include_str!("../../src/data/unique-image-map.json");
        serde_json::from_str::<HashMap<String, String>>(raw).unwrap_or_default()
    })
}

fn category_icon_map() -> &'static HashMap<String, String> {
    static CATEGORY_MAP: OnceLock<HashMap<String, String>> = OnceLock::new();
    CATEGORY_MAP.get_or_init(|| {
        let raw = include_str!("../../src/data/category-icon-map.json");
        serde_json::from_str::<HashMap<String, String>>(raw).unwrap_or_default()
    })
}

fn normalize_unique_name_key(value: &str) -> String {
    let mut out = String::new();
    let mut prev_is_underscore = false;
    for ch in value.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_is_underscore = false;
            continue;
        }
        if ch.is_whitespace() || ch == '_' || ch == '-' || ch == '\'' || ch == '’' {
            if !prev_is_underscore {
                out.push('_');
                prev_is_underscore = true;
            }
            continue;
        }
        if !prev_is_underscore {
            out.push('_');
            prev_is_underscore = true;
        }
    }
    out.trim_matches('_').to_string()
}

fn find_unique_mapped_icon(item_name: &str) -> Option<String> {
    let direct = unique_image_map().get(item_name.trim()).cloned();
    if direct.is_some() {
        return direct;
    }
    let wanted = normalize_unique_name_key(item_name);
    if wanted.is_empty() {
        return None;
    }
    unique_image_map()
        .iter()
        .find(|(key, _)| normalize_unique_name_key(key) == wanted)
        .map(|(_, value)| value.clone())
}

fn missing_icon_map() -> &'static Mutex<HashMap<String, i32>> {
    static MISSING_MAP: OnceLock<Mutex<HashMap<String, i32>>> = OnceLock::new();
    MISSING_MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

fn record_missing_icon(path: &str) {
    if let Ok(mut map) = missing_icon_map().lock() {
        let entry = map.entry(path.to_string()).or_insert(0);
        *entry += 1;
    }
}

fn encode_path_for_url(path: &str) -> String {
    path.split('/')
        .map(|segment| urlencoding::encode(segment).into_owned())
        .collect::<Vec<String>>()
        .join("/")
}

fn remote_icon_url(relative: &str) -> String {
    format!("{REMOTE_ICON_BASE}/{}", encode_path_for_url(relative))
}

fn cache_icon_path(exe_dir: &PathBuf, relative: &str) -> PathBuf {
    exe_dir.join("_up_").join("public").join(relative)
}

fn fetch_remote_icon(relative: &str, exe_dir: &PathBuf) -> Option<Vec<u8>> {
    let client = Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .ok()?;

    let response = client.get(remote_icon_url(relative)).send().ok()?;
    if !response.status().is_success() {
        return None;
    }

    let bytes = response.bytes().ok()?.to_vec();
    if bytes.is_empty() {
        return None;
    }

    let cache_path = cache_icon_path(exe_dir, relative);
    if let Some(parent) = cache_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(cache_path, &bytes);

    Some(bytes)
}

fn to_hash(text: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

fn extract_json_payload(raw_text: &str) -> Option<Value> {
    let trimmed = raw_text.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return None;
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return Some(value);
    }
    None
}

fn as_i32(value: &Value) -> Option<i32> {
    value.as_i64().and_then(|x| i32::try_from(x).ok())
}

fn as_f64(value: &Value) -> Option<f64> {
    value.as_f64()
}

fn classify_category(item_type: &str, quantity: Option<i32>) -> String {
    let normalized = item_type.trim().to_lowercase();
    if normalized.contains("rune") {
        return "rune".to_string();
    }
    if normalized.contains("map") || normalized.contains("shard") {
        return "map".to_string();
    }
    if quantity.unwrap_or(0) > 1 {
        return "material".to_string();
    }
    if normalized.contains("ring") {
        return "jewelry".to_string();
    }
    if normalized.contains("amulet") || normalized.contains("necklace") {
        return "jewelry".to_string();
    }
    if normalized.contains("charm") {
        return "charm".to_string();
    }
    if normalized.contains("jewel") {
        return "jewel".to_string();
    }
    if normalized.contains("quiver") || normalized.contains("arrow") || normalized.contains("bolt")
    {
        return "quiver".to_string();
    }
    if normalized.contains("shield")
        || normalized.contains("buckler")
        || normalized.contains("aegis")
    {
        return "shield".to_string();
    }
    if normalized.contains("belt") || normalized.contains("sash") {
        return "belt".to_string();
    }
    if normalized.contains("glove")
        || normalized.contains("gauntlet")
        || normalized.contains("bracer")
    {
        return "gloves".to_string();
    }
    if normalized.contains("boot") || normalized.contains("greave") {
        return "boots".to_string();
    }
    if normalized.contains("helm")
        || normalized.contains("helmet")
        || normalized.contains("cap")
        || normalized.contains("crown")
        || normalized.contains("circlet")
        || normalized.contains("antlers")
        || normalized.contains("pelt")
        || normalized.contains("mask")
    {
        return "helm".to_string();
    }
    if normalized.contains("armor")
        || normalized.contains("mail")
        || normalized.contains("plate")
        || normalized.contains("robe")
        || normalized.contains("leather")
        || normalized.contains("hide")
        || normalized.contains("coat")
    {
        return "armor".to_string();
    }
    if normalized.contains("sword")
        || normalized.contains("axe")
        || normalized.contains("mace")
        || normalized.contains("scepter")
        || normalized.contains("club")
        || normalized.contains("orb")
        || normalized.contains("hammer")
        || normalized.contains("dagger")
        || normalized.contains("knife")
        || normalized.contains("wand")
        || normalized.contains("staff")
        || normalized.contains("spear")
        || normalized.contains("polearm")
        || normalized.contains("javelin")
        || normalized.contains("bow")
        || normalized.contains("crossbow")
        || normalized.contains("claw")
        || normalized.contains("katar")
        || normalized.contains("cestus")
        || normalized.contains("talons")
        || normalized.contains("blade")
    {
        return "weapon".to_string();
    }
    "misc".to_string()
}

fn extract_thumbnail_from_json(item: &Value) -> Option<String> {
    let candidate = item
        .get("thumbnail")
        .and_then(Value::as_str)
        .or_else(|| item.get("iconPath").and_then(Value::as_str))
        .or_else(|| item.get("icon_path").and_then(Value::as_str))
        .or_else(|| item.get("image").and_then(Value::as_str))
        .or_else(|| item.get("image_url").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    Some(normalize_thumbnail_path(candidate))
}

fn resolve_thumbnail(item_name: &str, item_type: &str, quality: &str, category: &str) -> String {
    if quality.trim().eq_ignore_ascii_case("unique") {
        if let Some(mapped) = find_unique_mapped_icon(item_name) {
            let trimmed = mapped.trim().trim_start_matches('/');
            if trimmed.starts_with("icons/") {
                return format!("/{trimmed}");
            }
            if trimmed.contains('/') {
                return format!("/icons/{trimmed}");
            }

            let normalized_type = item_type.trim().to_lowercase();
            if normalized_type.contains("ring") {
                return format!("/icons/rings/{trimmed}");
            }
            if normalized_type.contains("amulet") || normalized_type.contains("necklace") {
                return format!("/icons/amulets/{trimmed}");
            }
            if category == "jewelry" {
                return format!("/icons/rings/{trimmed}");
            }
            if category == "charm" || category == "jewel" {
                return format!("/icons/charms_jewels/{trimmed}");
            }
            if category == "rune" {
                return format!("/icons/rune/{trimmed}");
            }
            if category == "map" || category == "material" {
                return format!("/icons/maps/{trimmed}");
            }
            return format!("/icons/weapons/{trimmed}");
        }
    }

    let normalized = item_type.trim().to_lowercase();
    if normalized.contains("rune") {
        return "/icons/rune/RuneEl.webp".to_string();
    }
    if normalized.contains("map") || normalized.contains("shard") || category == "map" {
        return "/icons/maps/Worldstone_Shard.webp".to_string();
    }
    if normalized.contains("ring") {
        return "/icons/rings/Ring_1.webp".to_string();
    }
    if normalized.contains("amulet") || normalized.contains("necklace") {
        return "/icons/amulets/Amulet_1.webp".to_string();
    }
    if normalized.contains("jewel") {
        return "/icons/charms_jewels/Jewel_blue.webp".to_string();
    }
    if normalized.contains("charm") {
        return "/icons/charms_jewels/Grand_Charm_2.webp".to_string();
    }

    if let Some(mapped) = category_icon_map().get(category) {
        if mapped.starts_with("icons/") {
            return format!("/{mapped}");
        }
        return format!("/icons/{mapped}");
    }
    "/icons/non-weapons/Quilted_Armor.webp".to_string()
}

fn is_generic_unknown_thumbnail(path: &str) -> bool {
    let normalized = path.trim().trim_start_matches('/').to_lowercase();
    normalized == "icons/generic/item_unknown.svg"
        || normalized == "generic/item_unknown.svg"
        || normalized.ends_with("/generic/item_unknown.svg")
}

fn normalize_thumbnail_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return "/icons/non-weapons/Quilted_Armor.webp".to_string();
    }
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with("blob:")
    {
        return trimmed.to_string();
    }
    if trimmed.starts_with("/icons/") {
        return trimmed.to_string();
    }
    if trimmed.starts_with("icons/") {
        return format!("/{trimmed}");
    }

    let normalized = trimmed.trim_start_matches('/');
    if normalized.starts_with("weapons/")
        || normalized.starts_with("non-weapons/")
        || normalized.starts_with("amulets/")
        || normalized.starts_with("rings/")
        || normalized.starts_with("maps/")
        || normalized.starts_with("rune/")
        || normalized.starts_with("charms_jewels/")
        || normalized.starts_with("quivers/")
        || normalized.starts_with("generic/")
    {
        return format!("/icons/{normalized}");
    }

    if normalized.contains('/')
        && (normalized.ends_with(".webp")
            || normalized.ends_with(".png")
            || normalized.ends_with(".svg"))
    {
        return format!("/icons/{normalized}");
    }

    if normalized.ends_with(".webp") || normalized.ends_with(".png") || normalized.ends_with(".svg")
    {
        return format!("/icons/{normalized}");
    }

    "/icons/non-weapons/Quilted_Armor.webp".to_string()
}

fn is_pd2_item_json(item: &Value) -> bool {
    let item_type = item
        .get("type")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    if item_type.is_empty() {
        return false;
    }

    let quality = item
        .get("quality")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    if quality.is_empty() {
        return false;
    }

    item.get("location")
        .and_then(Value::as_str)
        .map(str::trim)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
        || item.get("iLevel").and_then(Value::as_i64).is_some()
        || item.get("quantity").and_then(Value::as_i64).is_some()
        || item.get("defense").and_then(Value::as_i64).is_some()
        || item
            .get("stats")
            .and_then(Value::as_array)
            .map(|stats| !stats.is_empty())
            .unwrap_or(false)
        || item
            .get("name")
            .and_then(Value::as_str)
            .map(str::trim)
            .map(|value| !value.is_empty())
            .unwrap_or(false)
}

fn parse_item(raw_text: &str) -> Option<OverlayItem> {
    let now = Utc::now().to_rfc3339();
    let id = format!("loc-{}", Utc::now().timestamp_millis());

    if let Some(value) = extract_json_payload(raw_text) {
        let item = value.get("item").unwrap_or(&value);
        if !is_pd2_item_json(item) {
            return None;
        }
        let item_type = item.get("type")?.as_str()?.trim().to_string();
        let quality = item.get("quality")?.as_str()?.trim().to_string();
        let item_name = item
            .get("name")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| item_type.clone());
        let quantity = item.get("quantity").and_then(as_i32);
        let category = classify_category(&item_type, quantity);
        let corrupted = item
            .get("corrupted")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || raw_text.to_lowercase().contains("corrupt");

        let mut key_stats: Vec<String> = Vec::new();
        if let Some(stats) = item.get("stats").and_then(Value::as_array) {
            for stat in stats.iter().take(3) {
                if let Some(name) = stat.get("name").and_then(Value::as_str) {
                    if let Some(value) = stat.get("value").and_then(as_i32) {
                        key_stats.push(format!("{} {}", name.trim(), value));
                    } else {
                        key_stats.push(name.trim().to_string());
                    }
                }
            }
        }

        let thumbnail = extract_thumbnail_from_json(item).unwrap_or_else(|| {
            normalize_thumbnail_path(&resolve_thumbnail(
                &item_name, &item_type, &quality, &category,
            ))
        });

        return Some(OverlayItem {
            id,
            r#type: item_type.clone(),
            display_name: item_name.clone(),
            quality: quality.clone(),
            quantity,
            is_corrupted: corrupted,
            thumbnail,
            captured_at: now,
            key_stats,
            category,
            analysis_profile: "unknown".to_string(),
            analysis_tags: vec!["source:rust-local-api".to_string()],
        });
    }
    None
}

fn start_clipboard_capture(state: Arc<Mutex<SharedState>>) {
    thread::spawn(move || {
        let mut clipboard = Clipboard::new().ok();
        loop {
            if clipboard.is_none() {
                clipboard = Clipboard::new().ok();
                thread::sleep(Duration::from_millis(1200));
                continue;
            }

            let text = clipboard
                .as_mut()
                .and_then(|cp| cp.get_text().ok())
                .unwrap_or_default();
            if text.trim().is_empty() {
                thread::sleep(Duration::from_millis(1200));
                continue;
            }

            let hash = to_hash(&text);
            let mut guard = match state.lock() {
                Ok(guard) => guard,
                Err(_) => {
                    thread::sleep(Duration::from_millis(1200));
                    continue;
                }
            };

            if guard.last_hash == hash {
                drop(guard);
                thread::sleep(Duration::from_millis(1200));
                continue;
            }

            if let Some(item) = parse_item(&text) {
                guard.last_hash = hash;
                guard.items.insert(0, item);
                if guard.items.len() > MAX_ITEMS {
                    guard.items.truncate(MAX_ITEMS);
                }
            }

            drop(guard);
            thread::sleep(Duration::from_millis(1200));
        }
    });
}

fn overlay_html() -> &'static str {
    r#"<!doctype html>
<html>
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='width=device-width, initial-scale=1' />
  <title>PD2 Overlay</title>
  <style>
    body { margin: 0; background: transparent; color: #f2ead5; font-family: Segoe UI, sans-serif; }
    .header { padding: 8px 8px 0 8px; }
    .title { margin: 0; display: inline-block; border-radius: 6px; }
    .list { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
    .row { display: flex; gap: 8px; align-items: center; background: rgba(18,18,20,.85); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 6px 8px; }
    .thumb { width: 40px; height: 40px; object-fit: contain; background: rgba(0,0,0,.35); border-radius: 4px; }
    .name { font-size: 14px; font-weight: 600; }
    .stats { font-size: 11px; opacity: .9; }
    .empty { padding: 12px; opacity: .9; }
  </style>
</head>
<body>
  <div id='header' class='header'><p id='title' class='title'>Overlay Feed</p></div>
  <div id='list' class='list'></div>
  <script>
    const list = document.getElementById('list');
    const header = document.getElementById('header');
    const titleEl = document.getElementById('title');
    function esc(v){return String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
    async function refresh(){
      try {
        const res = await fetch('/api/overlay', { cache: 'no-store' });
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const title = data.title || 'Overlay Feed';
        document.title = title;
        titleEl.textContent = title;
        const titleEnabled = data.title_enabled !== false;
        header.style.display = titleEnabled ? '' : 'none';
        titleEl.style.fontSize = (Number(data.title_size || 18)) + 'px';
        titleEl.style.color = data.title_color || '#f7e6a8';
        const padding = Number(data.title_padding || 0);
        titleEl.style.padding = padding + 'px';
        titleEl.style.background = padding > 0 ? (data.title_background_color || '#1c1a1a') : 'transparent';
        const limit = Math.max(1, Number(data.overlay_item_limit || 10));
        const opacity = Math.min(1, Math.max(0.1, Number(data.overlay_opacity || 0.8)));
        const minimal = data.overlay_minimal_mode === true;
        if (!items.length) {
          list.innerHTML = '<p class="empty">No captured items yet.</p>';
          return;
        }
        list.innerHTML = items.slice(0, limit).map((item) => `
          <div class="row" style="opacity:${opacity}">
            <img class="thumb" src="${esc(item.thumbnail)}" onerror="this.src='/icons/generic/item_unknown.svg'" />
            <div>
              <div class="name">${esc(item.display_name)}</div>
              <div class="stats">${minimal ? '' : esc((item.key_stats || []).join(' · '))}</div>
            </div>
          </div>`).join('');
      } catch (e) {
        list.innerHTML = '<p class="empty">Overlay API unavailable.</p>';
      }
    }
    refresh();
    setInterval(refresh, 1200);
  </script>
</body>
</html>"#
}

fn serve_icons(
    resource_dir: &PathBuf,
    url_path: &str,
) -> Option<Response<std::io::Cursor<Vec<u8>>>> {
    let relative_raw = url_path.strip_prefix("/")?;
    let decoded = urlencoding::decode(relative_raw)
        .ok()
        .map(|value| value.into_owned())
        .unwrap_or_else(|| relative_raw.to_string());
    let relative = decoded.as_str();
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from))
        .unwrap_or_default();
    let candidates = [
        resource_dir.join(relative),
        resource_dir.join("public").join(relative),
        resource_dir.join("resources").join(relative),
        resource_dir.join("_up_").join(relative),
        resource_dir.join("_up_").join("public").join(relative),
        exe_dir.join(relative),
        exe_dir.join("public").join(relative),
        exe_dir.join("resources").join(relative),
        exe_dir.join("_up_").join(relative),
        exe_dir.join("_up_").join("public").join(relative),
        resource_dir
            .parent()
            .map(|parent| parent.join("_up_").join("public").join(relative))
            .unwrap_or_default(),
    ];

    let mut bytes: Option<Vec<u8>> = None;
    for path in candidates {
        if let Ok(content) = fs::read(path) {
            bytes = Some(content);
            break;
        }
    }

    if bytes.is_none() && relative.starts_with("icons/") {
        let file_name = if !relative[6..].contains('/') {
            relative[6..].to_string()
        } else {
            Path::new(relative)
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string)
                .unwrap_or_default()
        };
        if !file_name.is_empty() {
            let icon_roots = [
                resource_dir.join("icons"),
                resource_dir.join("public").join("icons"),
                resource_dir.join("_up_").join("public").join("icons"),
                exe_dir.join("icons"),
                exe_dir.join("public").join("icons"),
                exe_dir.join("_up_").join("public").join("icons"),
            ];

            for root in icon_roots {
                if let Some(found) = find_file_recursive(&root, &file_name) {
                    if let Ok(content) = fs::read(found) {
                        bytes = Some(content);
                        break;
                    }
                }
            }
        }
    }

    if bytes.is_none() && relative.starts_with("icons/") {
        bytes = fetch_remote_icon(relative, &exe_dir);
    }

    let bytes = if let Some(bytes) = bytes {
        bytes
    } else {
        record_missing_icon(relative);
        let fallback = br#"<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' rx='6' fill='#1e1e22'/><path d='M8 30L16 20L22 26L30 14L34 30H8Z' fill='#8d7f57'/></svg>"#.to_vec();
        let mut response = Response::from_data(fallback);
        if let Ok(header) =
            Header::from_bytes("Content-Type".as_bytes(), "image/svg+xml".as_bytes())
        {
            response = response.with_header(header);
        }
        return Some(with_cors(response));
    };
    let content_type = if url_path.ends_with(".svg") {
        "image/svg+xml"
    } else if url_path.ends_with(".webp") {
        "image/webp"
    } else if url_path.ends_with(".png") {
        "image/png"
    } else {
        "application/octet-stream"
    };

    let mut response = Response::from_data(bytes);
    if let Ok(header) = Header::from_bytes("Content-Type".as_bytes(), content_type.as_bytes()) {
        response = response.with_header(header);
    }
    Some(with_cors(response))
}

fn find_file_recursive(base: &PathBuf, file_name: &str) -> Option<PathBuf> {
    fn normalize_file_key(value: &str) -> String {
        value
            .to_lowercase()
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric())
            .collect()
    }

    if !base.exists() {
        return None;
    }

    let expected_stem = Path::new(file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name);
    let expected_key = normalize_file_key(expected_stem);

    let entries = fs::read_dir(base).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_file_recursive(&path, file_name) {
                return Some(found);
            }
            continue;
        }
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case(file_name))
            .unwrap_or(false)
        {
            return Some(path);
        }
        if !expected_key.is_empty() {
            let stem_matches = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .map(|stem| normalize_file_key(stem) == expected_key)
                .unwrap_or(false);
            if stem_matches {
                return Some(path);
            }
        }
    }
    None
}

fn with_cors<R: Read + Send + 'static>(mut response: Response<R>) -> Response<R> {
    if let Ok(header) = Header::from_bytes("Access-Control-Allow-Origin".as_bytes(), "*".as_bytes())
    {
        response = response.with_header(header);
    }
    if let Ok(header) = Header::from_bytes(
        "Access-Control-Allow-Methods".as_bytes(),
        "GET, PUT, DELETE, OPTIONS".as_bytes(),
    ) {
        response = response.with_header(header);
    }
    if let Ok(header) = Header::from_bytes(
        "Access-Control-Allow-Headers".as_bytes(),
        "Content-Type, Authorization".as_bytes(),
    ) {
        response = response.with_header(header);
    }
    response
}

pub fn start_local_overlay_server(resource_dir: PathBuf) {
    let settings_path = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|dir| dir.join("overlay-settings.json")))
        .unwrap_or_else(|| PathBuf::from("overlay-settings.json"));

    let settings = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<OverlaySettings>(&raw).ok())
        .map(sanitize_settings)
        .unwrap_or_default();

    let state = Arc::new(Mutex::new(SharedState {
        items: Vec::new(),
        last_hash: 0,
        settings,
        settings_path,
    }));

    start_clipboard_capture(Arc::clone(&state));

    thread::spawn(move || {
        let debug_resource_dir = resource_dir.clone();
        let server = match Server::http(SERVER_ADDR) {
            Ok(server) => server,
            Err(error) => {
                eprintln!("[overlay-api] failed to bind {SERVER_ADDR}: {error}");
                return;
            }
        };

        for mut request in server.incoming_requests() {
            if request.method() == &Method::Options {
                let _ = request.respond(with_cors(Response::empty(StatusCode(204))));
                continue;
            }

            if request.method() != &Method::Get
                && !(request.method() == &Method::Put && request.url().starts_with("/api/settings"))
                && !(request.method() == &Method::Put
                    && request.url().starts_with("/api/items/sync"))
                && !(request.method() == &Method::Delete && request.url().starts_with("/api/items"))
            {
                let _ = request.respond(with_cors(Response::empty(StatusCode(405))));
                continue;
            }

            let path = request.url().split('?').next().unwrap_or("/");
            match path {
                "/api/health" => {
                    let body = r#"{"ok":true}"#;
                    let mut response = Response::from_string(body);
                    if let Ok(header) =
                        Header::from_bytes("Content-Type".as_bytes(), "application/json".as_bytes())
                    {
                        response = response.with_header(header);
                    }
                    let _ = request.respond(with_cors(response));
                }
                "/api/overlay" => {
                    let (items, settings) = state
                        .lock()
                        .map(|guard| (guard.items.clone(), guard.settings.clone()))
                        .unwrap_or_else(|_| (Vec::new(), OverlaySettings::default()));
                    let items = items
                        .into_iter()
                        .map(|mut item| {
                            if is_generic_unknown_thumbnail(&item.thumbnail) {
                                item.thumbnail = normalize_thumbnail_path(&resolve_thumbnail(
                                    &item.display_name,
                                    &item.r#type,
                                    &item.quality,
                                    &item.category,
                                ));
                            }
                            item
                        })
                        .collect::<Vec<OverlayItem>>();
                    let settings = sanitize_settings(settings);
                    let payload = OverlayPayload {
                        title: settings.overlay_title,
                        title_enabled: settings.overlay_title_enabled,
                        title_size: settings.overlay_title_size,
                        title_color: settings.overlay_title_color,
                        title_background_color: settings.overlay_title_background_color,
                        title_padding: settings.overlay_title_padding,
                        overlay_item_limit: settings.overlay_item_limit,
                        overlay_opacity: settings.overlay_opacity,
                        overlay_minimal_mode: settings.overlay_minimal_mode,
                        items,
                    };

                    let body = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
                    let mut response = Response::from_string(body);
                    if let Ok(header) =
                        Header::from_bytes("Content-Type".as_bytes(), "application/json".as_bytes())
                    {
                        response = response.with_header(header);
                    }
                    let _ = request.respond(with_cors(response));
                }
                "/api/debug/resources" => {
                    let relative = "icons/generic/item_unknown.svg";
                    let candidates = vec![
                        debug_resource_dir.join(relative),
                        debug_resource_dir.join("public").join(relative),
                        debug_resource_dir.join("resources").join(relative),
                        debug_resource_dir.join("_up_").join(relative),
                        debug_resource_dir
                            .join("_up_")
                            .join("public")
                            .join(relative),
                        debug_resource_dir
                            .parent()
                            .map(|parent| parent.join("_up_").join("public").join(relative))
                            .unwrap_or_default(),
                    ];
                    let debug = ResourceDebug {
                        resource_dir: debug_resource_dir.display().to_string(),
                        candidates: candidates
                            .into_iter()
                            .map(|path| {
                                let exists = path.exists();
                                format!("{} :: exists={exists}", path.display())
                            })
                            .collect(),
                    };
                    let body = serde_json::to_string(&debug).unwrap_or_else(|_| "{}".to_string());
                    let mut response = Response::from_string(body);
                    if let Ok(header) =
                        Header::from_bytes("Content-Type".as_bytes(), "application/json".as_bytes())
                    {
                        response = response.with_header(header);
                    }
                    let _ = request.respond(with_cors(response));
                }
                "/api/debug/missing-icons" => {
                    let entries = missing_icon_map()
                        .lock()
                        .map(|map| map.clone())
                        .unwrap_or_default();
                    let body = serde_json::to_string(&entries).unwrap_or_else(|_| "{}".to_string());
                    let mut response = Response::from_string(body);
                    if let Ok(header) =
                        Header::from_bytes("Content-Type".as_bytes(), "application/json".as_bytes())
                    {
                        response = response.with_header(header);
                    }
                    let _ = request.respond(with_cors(response));
                }
                "/api/settings" => {
                    if request.method() == &Method::Get {
                        let settings = state
                            .lock()
                            .map(|guard| guard.settings.clone())
                            .unwrap_or_default();
                        let body =
                            serde_json::to_string(&settings).unwrap_or_else(|_| "{}".to_string());
                        let mut response = Response::from_string(body);
                        if let Ok(header) = Header::from_bytes(
                            "Content-Type".as_bytes(),
                            "application/json".as_bytes(),
                        ) {
                            response = response.with_header(header);
                        }
                        let _ = request.respond(with_cors(response));
                        continue;
                    }

                    let mut raw_body = String::new();
                    let _ = request.as_reader().read_to_string(&mut raw_body);
                    let patch = serde_json::from_str::<Value>(&raw_body).unwrap_or(Value::Null);

                    let mut updated = false;
                    if let Ok(mut guard) = state.lock() {
                        if let Some(next) = patch.get("overlay_title").and_then(Value::as_str) {
                            guard.settings.overlay_title = next.to_string();
                            updated = true;
                        }
                        if let Some(next) =
                            patch.get("overlay_title_enabled").and_then(Value::as_bool)
                        {
                            guard.settings.overlay_title_enabled = next;
                            updated = true;
                        }
                        if let Some(next) = patch.get("overlay_title_size").and_then(as_i32) {
                            guard.settings.overlay_title_size = next;
                            updated = true;
                        }
                        if let Some(next) = patch.get("overlay_title_color").and_then(Value::as_str)
                        {
                            guard.settings.overlay_title_color = next.to_string();
                            updated = true;
                        }
                        if let Some(next) = patch
                            .get("overlay_title_background_color")
                            .and_then(Value::as_str)
                        {
                            guard.settings.overlay_title_background_color = next.to_string();
                            updated = true;
                        }
                        if let Some(next) = patch.get("overlay_title_padding").and_then(as_i32) {
                            guard.settings.overlay_title_padding = next;
                            updated = true;
                        }
                        if let Some(next) = patch.get("overlay_item_limit").and_then(as_i32) {
                            guard.settings.overlay_item_limit = next;
                            updated = true;
                        }
                        if let Some(next) = patch.get("overlay_opacity").and_then(as_f64) {
                            guard.settings.overlay_opacity = next.clamp(0.1, 1.0);
                            updated = true;
                        }
                        if let Some(next) =
                            patch.get("overlay_minimal_mode").and_then(Value::as_bool)
                        {
                            guard.settings.overlay_minimal_mode = next;
                            updated = true;
                        }

                        if updated {
                            guard.settings = sanitize_settings(guard.settings.clone());
                            if let Ok(serialized) = serde_json::to_string_pretty(&guard.settings) {
                                let _ = fs::write(&guard.settings_path, serialized);
                            }
                        }

                        let body = serde_json::to_string(&guard.settings)
                            .unwrap_or_else(|_| "{}".to_string());
                        let mut response = Response::from_string(body);
                        if let Ok(header) = Header::from_bytes(
                            "Content-Type".as_bytes(),
                            "application/json".as_bytes(),
                        ) {
                            response = response.with_header(header);
                        }
                        let _ = request.respond(with_cors(response));
                    } else {
                        let _ = request.respond(with_cors(Response::empty(StatusCode(500))));
                    }
                }
                "/api/items" | "/api/items/clear" => {
                    if request.method() == &Method::Delete {
                        if let Ok(mut guard) = state.lock() {
                            let deleted = guard.items.len();
                            guard.items.clear();
                            let body = format!(r#"{{"deleted_items":{deleted}}}"#);
                            let mut response = Response::from_string(body);
                            if let Ok(header) = Header::from_bytes(
                                "Content-Type".as_bytes(),
                                "application/json".as_bytes(),
                            ) {
                                response = response.with_header(header);
                            }
                            let _ = request.respond(with_cors(response));
                        } else {
                            let _ = request.respond(with_cors(Response::empty(StatusCode(500))));
                        }
                        continue;
                    }
                    let _ = request.respond(with_cors(Response::empty(StatusCode(405))));
                }
                "/api/items/sync" => {
                    if request.method() == &Method::Put {
                        let mut raw_body = String::new();
                        let _ = request.as_reader().read_to_string(&mut raw_body);
                        let parsed = serde_json::from_str::<OverlaySyncPayload>(&raw_body)
                            .unwrap_or(OverlaySyncPayload { items: Vec::new() });

                        let mut next_items: Vec<OverlayItem> = parsed
                            .items
                            .into_iter()
                            .map(|entry| {
                                let item_type = if entry.r#type.trim().is_empty() {
                                    "Unknown".to_string()
                                } else {
                                    entry.r#type.trim().to_string()
                                };
                                let quality = if entry.quality.trim().is_empty() {
                                    "normal".to_string()
                                } else {
                                    entry.quality.trim().to_string()
                                };
                                let display_name_raw = if !entry.display_name.trim().is_empty() {
                                    entry.display_name.trim().to_string()
                                } else if !entry.display_name_alias.trim().is_empty() {
                                    entry.display_name_alias.trim().to_string()
                                } else {
                                    item_type.clone()
                                };
                                let category = if entry.category.trim().is_empty() {
                                    classify_category(&item_type, entry.quantity)
                                } else {
                                    entry.category.trim().to_string()
                                };
                                let is_corrupted = entry.is_corrupted || entry.is_corrupted_alias;
                                let thumbnail = {
                                    let normalized = normalize_thumbnail_path(&entry.thumbnail);
                                    if is_generic_unknown_thumbnail(&normalized) {
                                        normalize_thumbnail_path(&resolve_thumbnail(
                                            &display_name_raw,
                                            &item_type,
                                            &quality,
                                            &category,
                                        ))
                                    } else {
                                        normalized
                                    }
                                };
                                OverlayItem {
                                    id: entry.id,
                                    r#type: item_type,
                                    display_name: display_name_raw,
                                    quality,
                                    quantity: entry.quantity,
                                    is_corrupted,
                                    thumbnail,
                                    captured_at: if !entry.captured_at.trim().is_empty() {
                                        entry.captured_at
                                    } else if !entry.captured_at_alias.trim().is_empty() {
                                        entry.captured_at_alias
                                    } else {
                                        Utc::now().to_rfc3339()
                                    },
                                    key_stats: if !entry.key_stats.is_empty() {
                                        entry.key_stats
                                    } else {
                                        entry.key_stats_alias
                                    },
                                    category,
                                    analysis_profile: if !entry.analysis_profile.trim().is_empty() {
                                        entry.analysis_profile
                                    } else if !entry.analysis_profile_alias.trim().is_empty() {
                                        entry.analysis_profile_alias
                                    } else {
                                        "unknown".to_string()
                                    },
                                    analysis_tags: if !entry.analysis_tags.is_empty() {
                                        entry.analysis_tags
                                    } else {
                                        entry.analysis_tags_alias
                                    },
                                }
                            })
                            .collect();

                        next_items.sort_by(|left, right| right.captured_at.cmp(&left.captured_at));
                        if next_items.len() > MAX_ITEMS {
                            next_items.truncate(MAX_ITEMS);
                        }

                        if let Ok(mut guard) = state.lock() {
                            guard.items = next_items;
                            let body =
                                format!(r#"{{"synced":true,"count":{}}}"#, guard.items.len());
                            let mut response = Response::from_string(body);
                            if let Ok(header) = Header::from_bytes(
                                "Content-Type".as_bytes(),
                                "application/json".as_bytes(),
                            ) {
                                response = response.with_header(header);
                            }
                            let _ = request.respond(with_cors(response));
                        } else {
                            let _ = request.respond(with_cors(Response::empty(StatusCode(500))));
                        }
                        continue;
                    }
                    let _ = request.respond(with_cors(Response::empty(StatusCode(405))));
                }
                p if p.starts_with("/api/items/") => {
                    if request.method() == &Method::Delete {
                        let id = p.trim_start_matches("/api/items/").trim();
                        if id.is_empty() {
                            let _ = request.respond(with_cors(Response::empty(StatusCode(400))));
                            continue;
                        }
                        if let Ok(mut guard) = state.lock() {
                            let before = guard.items.len();
                            guard.items.retain(|item| item.id != id);
                            let deleted = before.saturating_sub(guard.items.len());
                            let body = format!(
                                r#"{{"deleted":{}}}"#,
                                if deleted > 0 { "true" } else { "false" }
                            );
                            let mut response = Response::from_string(body);
                            if let Ok(header) = Header::from_bytes(
                                "Content-Type".as_bytes(),
                                "application/json".as_bytes(),
                            ) {
                                response = response.with_header(header);
                            }
                            let _ = request.respond(with_cors(response));
                        } else {
                            let _ = request.respond(with_cors(Response::empty(StatusCode(500))));
                        }
                        continue;
                    }
                    let _ = request.respond(with_cors(Response::empty(StatusCode(405))));
                }
                "/overlay" => {
                    let mut response = Response::from_string(overlay_html());
                    if let Ok(header) = Header::from_bytes(
                        "Content-Type".as_bytes(),
                        "text/html; charset=utf-8".as_bytes(),
                    ) {
                        response = response.with_header(header);
                    }
                    let _ = request.respond(with_cors(response));
                }
                _ => {
                    if path.starts_with("/icons/") {
                        if let Some(response) = serve_icons(&resource_dir, path) {
                            let _ = request.respond(response);
                        } else {
                            let _ = request.respond(with_cors(Response::empty(StatusCode(404))));
                        }
                    } else {
                        let _ = request.respond(with_cors(Response::empty(StatusCode(404))));
                    }
                }
            }
        }
    });
}
