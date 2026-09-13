'use client'

type Props = {
  activeCount: number
  onClick: () => void
}

// Filter chip. Sits at the right end of the floating view-pill row on Map and
// List (header 1c); HomeView positions that row, so the chip no longer places
// itself.
export default function FilterButton({ activeCount, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 44,
        padding: '0 14px',
        boxSizing: 'border-box',
        flexShrink: 0,
        backgroundColor: 'rgba(247, 243, 238, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(237, 232, 227, 0.9)',
        borderRadius: 999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: '#1C1917',
        userSelect: 'none',
      }}
      aria-label={activeCount > 0 ? `Filter (${activeCount} active)` : 'Filter'}
    >
      {/* Funnel icon */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      Filter
      {activeCount > 0 && (
        <span
          style={{
            backgroundColor: '#C2410C',
            color: 'white',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            marginLeft: 2,
          }}
        >
          {activeCount}
        </span>
      )}
    </button>
  )
}
