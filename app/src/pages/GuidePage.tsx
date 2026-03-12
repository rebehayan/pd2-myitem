import { useUiLanguage } from '../lib/ui-language-context'

export function GuidePage() {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: '사용자 가이드',
          subtitle: '처음 사용하는 분도 바로 따라할 수 있도록 실제 사용 순서 중심으로 안내합니다.',
          featureTitle: '이 서비스에서 할 수 있는 일',
          captureTitle: '아이템 정보 입력 방식',
          quickStartTitle: '빠른 시작 (처음 3분)',
          flowTitle: '상황별 사용 방법',
          streamStartTitle: '방송 시작 전 체크리스트',
          streamEndTitle: '방송 종료 후 체크리스트',
          faqTitle: '자주 묻는 질문',
          cautionTitle: '주의 사항',
          features: [
            {
              name: '실시간 아이템 확인',
              desc: '대시보드에서 새로 들어온 아이템을 즉시 확인하고 상세 정보를 열 수 있습니다.',
            },
            {
              name: '방송 오버레이 표시',
              desc: '오버레이 페이지를 OBS 브라우저 소스로 연결해 방송 화면에 아이템 목록을 보여줄 수 있습니다.',
            },
            {
              name: '오늘 획득 기록 관리',
              desc: '투데이 페이지에서 날짜별 통계와 아이템 목록을 보고 공유 링크를 사용할 수 있습니다.',
            },
            {
              name: '오버레이/공개 설정 제어',
              desc: '설정 페이지에서 오버레이 표시 수, 투명도, QR 공개 여부, 토큰 등을 변경할 수 있습니다.',
            },
          ],
          captureSteps: [
            '게임에서 확인할 아이템 위에 마우스를 올려 툴팁을 띄웁니다.',
            '아이템 툴팁이 보이는 상태에서 Ctrl+C를 눌러 아이템 정보를 복사합니다.',
            '복사된 텍스트가 앱으로 추출되어 대시보드/투데이에 반영됩니다.',
          ],
          quickStart: [
            '상단 메뉴에서 설정으로 이동해 오버레이 표시 개수/투명도를 먼저 저장합니다.',
            '오버레이 메뉴를 열고 해당 주소를 복사해 OBS 브라우저 소스로 추가합니다.',
            '대시보드에서 아이템이 정상으로 들어오는지 확인합니다.',
            '투데이 페이지에서 오늘 기록과 통계가 보이는지 확인합니다.',
          ],
          flows: [
            {
              title: '1) 방송 시작 전 준비',
              items: [
                '설정에서 오버레이 제목, 표시 수, 최소 모드 여부를 결정합니다.',
                '오버레이 주소를 OBS 브라우저 소스에 등록하고 위치를 배치합니다.',
                '대시보드에서 최근 아이템이 보이면 준비 완료입니다.',
              ],
            },
            {
              title: '2) 방송 중 운영',
              items: [
                '대시보드에서 신규 아이템이 누락 없이 들어오는지 주기적으로 확인합니다.',
                '화면이 복잡하면 설정에서 최소 모드를 켜 오버레이를 간결하게 유지합니다.',
                '중요 아이템은 아이템 상세 페이지에서 옵션/배지를 확인해 즉시 설명할 수 있습니다.',
              ],
            },
            {
              title: '3) 시청자 공유(투데이/QR)',
              items: [
                '설정에서 QR 공개 기능을 켜고 필요하면 토큰을 재생성합니다.',
                '투데이 페이지 링크를 QR 또는 링크로 공유해 시청자에게 오늘 획득 내역을 보여줍니다.',
                '공유를 멈출 때는 QR 공개를 끄거나 토큰을 재생성해 기존 링크 접근을 차단합니다.',
              ],
            },
          ],
          streamStartChecklist: [
            '설정에서 오버레이 표시 수/투명도/최소 모드 값을 확인하고 저장합니다.',
            'OBS 브라우저 소스 URL이 현재 오버레이 주소와 정확히 일치하는지 확인합니다.',
            '대시보드에서 최근 아이템 유입이 정상인지 1회 이상 점검합니다.',
            '투데이 페이지 날짜/통계가 오늘 기준으로 표시되는지 확인합니다.',
            '공유가 필요하면 QR 공개 상태와 토큰 값을 확인합니다.',
          ],
          streamEndChecklist: [
            'QR 공개를 종료하거나 토큰을 재생성해 기존 공유 링크 접근을 차단합니다.',
            'OBS 소스/씬 프리셋 변경 사항이 있으면 다음 방송용으로 저장합니다.',
            '문제 발생 로그나 특이 케이스를 기록해 다음 방송 전에 재확인합니다.',
          ],
          faqs: [
            {
              q: '오버레이가 안 보일 때는 어떻게 하나요?',
              a: 'OBS 브라우저 소스 URL이 현재 오버레이 주소와 동일한지 확인한 뒤, 소스 새로고침(또는 캐시 무시 새로고침)과 앱 설정 재저장을 순서대로 진행하세요.',
            },
            {
              q: '시청자에게 보여주는 링크 접근을 막고 싶어요.',
              a: '설정에서 QR 공개를 끄거나 토큰을 재생성하면 기존 링크 접근을 차단할 수 있습니다. 방송 종료 직후 토큰 재생성을 운영 기본값으로 두는 것을 권장합니다.',
            },
            {
              q: '한국어/영어 전환은 어디서 하나요?',
              a: '상단 헤더의 언어 전환 버튼으로 즉시 변경할 수 있습니다.',
            },
            {
              q: '아이템이 가끔 늦게 보이는 것 같아요.',
              a: '대시보드 기준으로 먼저 반영 여부를 확인하고, OBS 오버레이가 지연되면 브라우저 소스 FPS/하드웨어 가속/새로고침 주기를 점검하세요.',
            },
            {
              q: '아이템 정보는 어떻게 입력하나요?',
              a: '게임에서 아이템에 마우스를 올린 뒤 Ctrl+C를 누르면 아이템 정보가 추출되어 앱에 자동 반영됩니다.',
            },
            {
              q: '방송 중 공개 링크를 계속 열어둬도 되나요?',
              a: '가능하지만 보안 관점에서 세션 단위 운영을 권장합니다. 방송 시작 시 토큰 생성, 종료 시 토큰 재생성으로 링크 수명을 짧게 유지하세요.',
            },
          ],
          cautions: [
            '공유 링크를 외부에 공개했다면 방송 종료 후 토큰 재생성을 권장합니다.',
            '오버레이 주소를 변경했다면 OBS 브라우저 소스도 같은 주소로 맞춰야 합니다.',
            '방송 프로필(씬 컬렉션)별로 오버레이 소스 주소를 따로 관리하면 실수 배포를 줄일 수 있습니다.',
            '문제 발생 시 설정 변경을 연속으로 여러 번 하지 말고, 저장 -> 새로고침 -> 확인 순서로 한 단계씩 점검하세요.',
          ],
        }
      : {
          title: 'Guide',
          subtitle: 'A quick overview of PD2 Broadcast Item Tracker features and workflows.',
          featureTitle: 'Key Features',
          captureTitle: 'How Item Input Works',
          quickStartTitle: 'Quick Start',
          flowTitle: 'Usage Flows',
          streamStartTitle: 'Pre-stream Checklist',
          streamEndTitle: 'Post-stream Checklist',
          faqTitle: 'FAQ',
          cautionTitle: 'Cautions',
          features: [
            {
              name: 'Dashboard',
              desc: 'Check tracked items in real time and review details of selected entries.',
            },
            {
              name: 'Overlay',
              desc: 'Use an overlay-focused view for streaming with new-item emphasis.',
            },
            {
              name: 'Today Page',
              desc: 'Browse daily stats and list views with optional shared-link access.',
            },
            {
              name: 'Item Detail',
              desc: 'Inspect item theme, stat lines, and badge states in depth.',
            },
            {
              name: 'Settings',
              desc: 'Configure overlay count, opacity, title style, and QR sharing token.',
            },
            {
              name: 'Sign-in / Guest',
              desc: 'Run with account sign-in or local-first guest mode.',
            },
          ],
          captureSteps: [
            'Hover your mouse over the target item in-game to open its tooltip.',
            'While the tooltip is visible, press Ctrl+C to copy item data.',
            'The copied payload is extracted by the app and reflected on Dashboard/Today.',
          ],
          quickStart: [
            'Save overlay display options in Settings first.',
            'Connect Overlay URL to your stream browser source.',
            'Verify incoming items in Dashboard.',
            'Check daily stats and list in Today page.',
          ],
          flows: [
            {
              title: '1) Before streaming',
              items: ['Configure overlay settings.', 'Attach overlay URL in OBS.', 'Verify dashboard data flow.'],
            },
            {
              title: '2) During streaming',
              items: ['Monitor incoming items.', 'Use minimal mode when needed.', 'Use detail page for explanation.'],
            },
            {
              title: '3) Sharing with viewers',
              items: ['Enable QR sharing.', 'Share Today link.', 'Disable sharing or rotate token after stream.'],
            },
          ],
          streamStartChecklist: [
            'Verify overlay count/opacity/minimal mode in Settings and save.',
            'Confirm OBS browser source URL matches the current overlay URL.',
            'Check Dashboard once to verify incoming item flow.',
            'Confirm Today page date/stats are up to date.',
            'If sharing is needed, verify public mode and QR token.',
          ],
          streamEndChecklist: [
            'Disable public sharing or rotate QR token to revoke old links.',
            'Save OBS scene/source changes for the next stream.',
            'Record notable issues for next-session validation.',
          ],
          faqs: [
            {
              q: 'Overlay is not visible. What should I check?',
              a: 'Confirm browser source URL first, then save settings and refresh with cache bypass.',
            },
            {
              q: 'How can I revoke shared access?',
              a: 'Disable public mode or rotate the QR token. Token rotation after each stream is recommended.',
            },
            {
              q: 'Where can I switch language?',
              a: 'Use the language button in the top header.',
            },
            {
              q: 'Why does overlay look delayed sometimes?',
              a: 'Check data first on Dashboard, then review OBS browser source refresh/FPS/hardware acceleration settings.',
            },
          ],
          cautions: [
            'Rotate QR token after public sharing.',
            'Keep OBS source URL synchronized with current overlay URL.',
            'Manage overlay source URLs per scene profile to avoid wrong-source incidents.',
          ],
        }

  return (
    <section className="d2-panel d2-ui guide-page">
      <div className="d2-panel__header">
        <div>
          <h2 className="d2-panel__title">{text.title}</h2>
          <p className="d2-panel__subtitle">{text.subtitle}</p>
        </div>
      </div>

      <div className="guide-section">
        <h3>{text.featureTitle}</h3>
        <ul className="guide-list">
          {text.features.map((feature) => (
            <li key={feature.name} className="guide-item">
              <strong>{feature.name}</strong>
              <p>{feature.desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="guide-section">
        <h3>{text.captureTitle}</h3>
        <ol className="guide-steps">
          {text.captureSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="guide-section">
        <h3>{text.quickStartTitle}</h3>
        <ol className="guide-steps">
          {text.quickStart.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="guide-section">
        <h3>{text.flowTitle}</h3>
        <div className="guide-flow-grid">
          {text.flows.map((flow) => (
            <article key={flow.title} className="guide-flow-card">
              <h4>{flow.title}</h4>
              <ul className="guide-list guide-list--compact">
                {flow.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="guide-section">
        <h3>{text.streamStartTitle}</h3>
        <ol className="guide-steps">
          {text.streamStartChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="guide-section">
        <h3>{text.streamEndTitle}</h3>
        <ol className="guide-steps">
          {text.streamEndChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="guide-section">
        <h3>{text.faqTitle}</h3>
        <ul className="guide-list guide-list--compact">
          {text.faqs.map((faq) => (
            <li key={faq.q} className="guide-item">
              <strong>{faq.q}</strong>
              <p>{faq.a}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="guide-section">
        <h3>{text.cautionTitle}</h3>
        <ul className="guide-list guide-list--compact">
          {text.cautions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
