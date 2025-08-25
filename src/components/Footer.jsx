// src/components/Footer.jsx
'use client';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-text site-footer-top">
        <div className="site-footer-top-left">
          <div className="site-footer-contact">
            <a href="mailto:office@comfortmagazine.world" className="footer-contact">office@comfortmagazine.world</a>
            <a href="https://www.instagram.com/comfortmagazine" target="_blank" rel="noopener noreferrer" className="footer-instagram">@comfortmagazine</a>
            <p className="site-footer-tagline">COMFROT ideas for a better tomorrow.</p>
          </div>
        </div>

        <div className="site-footer-top-right">
         
        </div>
      </div>

      <div className="site-footer-logo-wrap">
        <img src="/COMFORT_MAG_LOGO_WHITE.svg" alt="COMFORT" className="site-footer-logo" />
      </div>
    </footer>
  );
}
