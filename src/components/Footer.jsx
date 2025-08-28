// src/components/Footer.jsx
'use client';

import { useEffect, useState } from 'react';

export default function Footer() {
  const [laTime, setLaTime] = useState('');

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles',
    });

    const update = () => setLaTime(fmt.format(new Date()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="site-footer">
      <div className="site-footer-text site-footer-top">
        <div className="site-footer-top-left">
          <div className="site-footer-contact">
          
          </div>
          <div className="site-footer-time" aria-live="polite">
            Los Angeles |{' '}
            {laTime
              ? (() => {
                  const [h, m, ...rest] = laTime.split(':');
                  // If laTime includes AM/PM, join rest
                  const suffix = rest.length ? `:${rest.join(':')}` : '';
                  return (
                    <>
                      {h}
                      <span className="blink-colon">:</span>
                      {m}
                      {suffix}
                    </>
                  );
                })()
              : ''}
          </div>
          <div className="site-designer">
            Site designed by{' '}
            <a href="https://clintonvanarnam.net" target="_blank" rel="noopener noreferrer">
              Clinton Van Arnam
            </a>
          </div>
        </div>

        <div className="site-footer-top-right">
         
        </div>
      </div>

      <div className="site-footer-logo-wrap">
        <img src="/COMFORT_MAG_LOGO_BLACK.svg" alt="COMFORT" className="site-footer-logo" />
      </div>

      <style jsx>{`
        .blink-colon {
          display: inline-block;
          margin-left: 0.15rem;
          /* blink via opacity steps to mimic a cursor-like blink */
          animation: colon-blink 1s steps(1, start) infinite;
        }

        .site-footer-time {
          margin: 0; /* remove default spacing */
        }

        .site-designer {
          margin-top: 0; /* no gap */
          font-size: inherit; /* match the time text */
          color: inherit; /* match color */
          opacity: 1; /* ensure same weight */
          line-height: 1.2;
        }

        .site-designer a {
          color: inherit;
          text-decoration: underline;
          text-decoration-thickness: 1px;
        }

        @keyframes colon-blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .blink-colon {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </footer>
  );
}
