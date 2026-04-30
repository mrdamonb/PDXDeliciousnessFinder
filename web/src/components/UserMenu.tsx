'use client'

import { useState } from 'react'
import { signOut } from '@/app/actions'

type Props = {
  email: string
}

export default function UserMenu({ email }: Props) {
  const [open, setOpen] = useState(false)

  function handleToggle() {
    setOpen((o) => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleToggle}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: '#C2410C',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-label="User menu"
        aria-expanded={open}
      >
        {email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <>
          {/* Invisible full-screen overlay to catch outside clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 39 }}
            onMouseDown={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 52,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #EDE8E3',
              borderRadius: 10,
              padding: '6px 0',
              width: 200,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 40,
              fontSize: 13,
            }}
          >
            <p
              style={{
                padding: '6px 14px 4px',
                fontSize: 11,
                color: '#6B6560',
                wordBreak: 'break-all',
              }}
            >
              {email}
            </p>
            <div style={{ height: 1, backgroundColor: '#EDE8E3', margin: '4px 0' }} />
            <form action={signOut}>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '7px 14px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#DC2626',
                  display: 'block',
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = '#F7F3EE')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = 'transparent')}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
