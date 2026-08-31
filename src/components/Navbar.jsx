import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import sriKrishnaDesignersLogo from '../assets/sri-krishna-designers-logo.webp';
import './Navbar.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 36);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        <a href="#home" className="nav-logo" onClick={closeMenu} aria-label="Sri Krishna Designers home">
          <img src={sriKrishnaDesignersLogo} alt="Sri Krishna Designers" />
        </a>

        <button
          type="button"
          className="nav-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isMenuOpen}
          aria-controls="primary-navigation"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav id="primary-navigation" className={`nav-menu ${isMenuOpen ? 'active' : ''}`} aria-label="Primary navigation">
          <a href="#home" className="nav-link" onClick={closeMenu}>Home</a>
          <a href="#services" className="nav-link" onClick={closeMenu}>The Studio</a>
          <a href="#contact" className="nav-link" onClick={closeMenu}>Contact</a>
        </nav>

        <a href="#contact" className="nav-cta">Enquire</a>
      </div>
    </header>
  );
};

export default Navbar;
