import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './d2-ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'ember'
type ButtonSize = 'sm' | 'md' | 'lg'

type D2PanelProps = {
  title?: string
  subtitle?: string
  sigil?: string
  className?: string
  children: ReactNode
}

type D2ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

type D2ItemCardProps = {
  name: string
  type: string
  quality: 'unique' | 'rare' | 'magic' | 'set' | 'normal'
  level: number
  stats: Array<{ label: string; value: string }>
  icon?: string
  isCorrupted?: boolean
}

type D2OverlayItem = {
  id: string
  name: string
  detail: string
  sigil: string
  isNew?: boolean
}

type D2OverlayListProps = {
  items: D2OverlayItem[]
}

type D2TooltipProps = {
  label: string
  children: ReactNode
}

export function D2Panel({ title, subtitle, sigil, className, children }: D2PanelProps) {
  return (
    <section className={`d2-panel d2-ui${className ? ` ${className}` : ''}`}>
      {(title || sigil) && (
        <header className="d2-panel__header">
          <div>
            {title ? <h2 className="d2-panel__title">{title}</h2> : null}
            {subtitle ? <p className="d2-panel__subtitle">{subtitle}</p> : null}
          </div>
          {sigil ? <span className="d2-panel__sigil">{sigil}</span> : null}
        </header>
      )}
      <div className="d2-panel__body">{children}</div>
    </section>
  )
}

export function D2Button({ variant = 'primary', size = 'md', className, ...props }: D2ButtonProps) {
  return (
    <button
      type="button"
      className={`d2-button d2-button--${variant} d2-button--${size}${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}

export function D2ItemCard({ name, type, quality, level, stats, icon, isCorrupted }: D2ItemCardProps) {
  return (
    <article className="d2-item-card d2-ui">
      <div className="d2-item-card__header">
        {icon ? <img className="d2-item-card__icon" src={icon} alt="" /> : null}
        <div>
          <h3 className="d2-item-card__name">{name}</h3>
          <p className="d2-item-card__meta">
            {type} · iLvl {level}
          </p>
          <span className={`d2-item-card__quality is-${quality}`}>{quality}</span>
        </div>
      </div>
      <ul className="d2-item-card__stats">
        {stats.map((stat) => (
          <li key={stat.label} className="d2-item-card__stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </li>
        ))}
      </ul>
      {isCorrupted ? <div className="d2-item-card__corrupted">Corrupted</div> : null}
    </article>
  )
}

export function D2OverlayList({ items }: D2OverlayListProps) {
  return (
    <ul className="d2-overlay-list d2-ui" role="list">
      {items.map((item) => (
        <li key={item.id} className={`d2-overlay-item${item.isNew ? ' is-new' : ''}`}>
          <div className="d2-overlay-item__sigil">{item.sigil}</div>
          <div className="d2-overlay-item__body">
            <h4 className="d2-overlay-item__name">{item.name}</h4>
            <p className="d2-overlay-item__detail">{item.detail}</p>
          </div>
          <span className="d2-overlay-item__tag">Loot</span>
        </li>
      ))}
    </ul>
  )
}

export function D2Tooltip({ label, children }: D2TooltipProps) {
  return (
    <span className="d2-tooltip d2-ui" data-label={label} tabIndex={0}>
      {children}
    </span>
  )
}
