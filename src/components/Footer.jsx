import React from 'react';
import { ArrowUpRight, Mail, Phone } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer id="contact" className="footer">
      <div className="container">
        <section className="footer-invitation" aria-labelledby="contact-heading">
          <p className="eyebrow">Appointments</p>
          <h2 id="contact-heading">Your next piece starts<br />with a <em>conversation.</em></h2>
          <a href="tel:+919876543210" className="footer-phone">
            +91 98765 43210 <ArrowUpRight size={22} aria-hidden="true" />
          </a>
        </section>

        <div className="footer-details">
          <div className="footer-brand">
            <a href="#home" className="footer-logo">Sri Krishna <em>Designers</em></a>
            <p>A personal tailoring studio for women, built on craftsmanship, comfort, and care.</p>
          </div>

          <div className="footer-column">
            <span className="footer-label">Get in touch</span>
            <a href="mailto:contact@srikrishnadesigners.com"><Mail size={16} aria-hidden="true" /> contact@srikrishnadesigners.com</a>
            <a href="tel:+919876543210"><Phone size={16} aria-hidden="true" /> +91 98765 43210</a>
            <p>Studio visits by appointment.</p>
          </div>

          <nav className="footer-column" aria-label="Footer navigation">
            <span className="footer-label">Explore</span>
            <a href="#home">Home</a>
            <a href="#services">The studio</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>

        <div className="footer-bottom">
          <p suppressHydrationWarning>© {new Date().getFullYear()} Sri Krishna Designers</p>
          <p>Designed with attention to detail.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
