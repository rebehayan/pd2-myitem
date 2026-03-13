import { Link } from 'react-router-dom'
import { useUiLanguage } from '../lib/ui-language-context'

type NotFoundPageProps = {
  overlayMode?: boolean
}

export function NotFoundPage({ overlayMode = false }: NotFoundPageProps) {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          code: '404',
          title: '페이지를 찾을 수 없습니다',
          description: overlayMode
            ? '오버레이 경로가 잘못되었습니다. /overlay 주소로 다시 열어주세요.'
            : '요청한 주소가 없거나 이동되었습니다.',
          home: '대시보드로 이동',
          overlay: '오버레이 열기',
        }
      : {
          code: '404',
          title: 'Page not found',
          description: overlayMode
            ? 'Overlay route is invalid. Open the overlay again at /overlay.'
            : 'The requested address does not exist or has moved.',
          home: 'Go to dashboard',
          overlay: 'Open overlay',
        }

  return (
    <section className={`not-found-page${overlayMode ? ' not-found-page--overlay' : ''}`} aria-label="Not found page">
      <p className="not-found-page__code">{text.code}</p>
      <h2>{text.title}</h2>
      <p>{text.description}</p>
      <div className="not-found-page__actions">
        <Link to="/" className="button-secondary">
          {text.home}
        </Link>
        <a href="/overlay" className="button-secondary" target="_blank" rel="noreferrer">
          {text.overlay}
        </a>
      </div>
    </section>
  )
}
