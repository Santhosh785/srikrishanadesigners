import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import './Hero.css';

const Hero = () => {
  return (
    <section id="home" className="hero">
      <div className="hero-wordmark" aria-hidden="true">Sri Krishna</div>
      <div className="container hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">Women's tailoring · by appointment</p>
          <h1>Designed for<br /><em>your moment.</em></h1>
          <p className="hero-description">
            A quiet, considered tailoring studio for women who value a beautiful fit,
            personal details, and clothing made with intention.
          </p>
          <div className="hero-actions">
            <a href="#contact" className="btn btn-primary">
              Book an appointment <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a href="#services" className="text-link">Discover the studio <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-notes" aria-label="Our approach">
            <div><strong>01</strong><span>Personal consultation</span></div>
            <div><strong>02</strong><span>Made around you</span></div>
            <div><strong>03</strong><span>Final fitting</span></div>
          </div>
        </div>

        <figure className="hero-portrait">
          <div className="portrait-frame">
            <img
              src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=85&w=1600&auto=format&fit=crop"
              alt="Detailed traditional women's attire"
              className="hero-image"
            />
          </div>
          <figcaption><span>SKD</span> Tailored with care</figcaption>
          <div className="portrait-stamp" aria-hidden="true">The art<br />of a good<br />fit</div>
        </figure>
      </div>
    </section>
  );
};

export default Hero;
