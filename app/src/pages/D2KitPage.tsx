import { D2Button, D2ItemCard, D2OverlayList, D2Panel, D2Tooltip } from '../components/d2-ui'

const overlayItems = [
  { id: '1', name: 'Harlequin Crest', detail: 'Unique Shako · iLvl 86', sigil: 'H', isNew: true },
  { id: '2', name: 'Tal Rasha Relic', detail: 'Set Amulet · iLvl 78', sigil: 'T' },
  { id: '3', name: 'Stormspire', detail: 'Rare Spear · iLvl 72', sigil: 'S' },
]

export function D2KitPage() {
  return (
    <section className="d2-demo">
      <D2Panel
        title="Sanctuary Vault"
        subtitle="Gothic panel, gilded frame, stone texture."
        sigil="Act IV"
      >
        <div className="d2-demo__actions">
          <D2Button variant="primary">Claim Relic</D2Button>
          <D2Button variant="secondary">Inspect</D2Button>
          <D2Button variant="ember">Summon</D2Button>
          <D2Tooltip label="Forged in hellfire. Use sparingly.">Sigil of Flame</D2Tooltip>
        </div>
        <div className="d2-divider" />
        <div className="d2-banner">
          <h3 className="d2-banner__title">Vault Ward</h3>
          <p className="d2-banner__text">The vault seal is weakening. Reinforce with runes.</p>
        </div>
        <div className="d2-divider" />
        <div className="d2-stat-grid">
          <div className="d2-stat">
            <p className="d2-stat__label">Sanctity</p>
            <p className="d2-stat__value">84%</p>
          </div>
          <div className="d2-stat">
            <p className="d2-stat__label">Flames</p>
            <p className="d2-stat__value">+17</p>
          </div>
          <div className="d2-stat">
            <p className="d2-stat__label">Corruption</p>
            <p className="d2-stat__value">Low</p>
          </div>
        </div>
        <div className="d2-divider" />
        <div className="d2-demo__row">
          <label className="d2-field">
            <span className="d2-label">Rune Socket</span>
            <input className="d2-input" placeholder="Insert rune code" />
          </label>
          <label className="d2-field">
            <span className="d2-label">Ward Type</span>
            <select className="d2-select">
              <option>Gilded</option>
              <option>Bloodforged</option>
              <option>Shadowbound</option>
            </select>
          </label>
        </div>
        <div className="d2-divider" />
        <div className="d2-tabs" role="tablist" aria-label="Vault modes">
          <button className="d2-tab is-active" role="tab">
            Seal
          </button>
          <button className="d2-tab" role="tab">
            Purify
          </button>
          <button className="d2-tab" role="tab">
            Sacrifice
          </button>
        </div>
        <div className="d2-divider" />
        <div className="d2-chips">
          <span className="d2-chip">
            <span className="d2-chip__rune">EL</span>
            Ember
          </span>
          <span className="d2-chip">
            <span className="d2-chip__rune">SOL</span>
            Aegis
          </span>
          <span className="d2-chip">
            <span className="d2-chip__rune">IST</span>
            Gild
          </span>
        </div>
        <div className="d2-divider" />
        <div className="d2-progress" aria-label="Vault stability">
          <div className="d2-progress__fill" style={{ width: '62%' }} />
        </div>
      </D2Panel>

      <div className="d2-demo__row">
        <D2ItemCard
          name="Bane of the Fallen"
          type="Legendary Sword"
          quality="unique"
          level={91}
          isCorrupted
          stats={[
            { label: 'Damage', value: '324-410' },
            { label: 'All Res', value: '+28' },
            { label: 'Life Steal', value: '7%' },
          ]}
        />
        <D2ItemCard
          name="Gilded Talon"
          type="Rare Claw"
          quality="rare"
          level={74}
          stats={[
            { label: 'Attack Speed', value: '+25%' },
            { label: 'Dexterity', value: '+18' },
            { label: 'Open Wounds', value: '18%' },
          ]}
        />
      </div>

      <D2Panel title="Overlay Feed" subtitle="Compact drops list for stream overlays.">
        <D2OverlayList items={overlayItems} />
      </D2Panel>
    </section>
  )
}
