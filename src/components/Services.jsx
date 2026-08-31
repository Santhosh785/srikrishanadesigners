import React from 'react';
import { Ruler, Scissors, Sparkles } from 'lucide-react';
import './Services.css';

const servicesList = [
  {
    icon: <Scissors size={22} strokeWidth={1.6} />,
    title: 'Bespoke tailoring',
    description: 'Made-to-measure silhouettes, finished with the details that make a piece feel like yours.'
  },
  {
    icon: <Ruler size={22} strokeWidth={1.6} />,
    title: 'Thoughtful alterations',
    description: 'Careful adjustments that restore ease, balance, and confidence to the clothes you love.'
  },
  {
    icon: <Sparkles size={22} strokeWidth={1.6} />,
    title: 'Occasion dressing',
    description: 'Custom outfits for celebrations and meaningful days, from the first idea to the final fitting.'
  }
];

const Services = () => {
  return (
    <section id="services" className="services">
      <div className="container">
        <div className="services-heading">
          <div>
            <p className="eyebrow">The studio</p>
            <h2>Made around <em>you.</em></h2>
          </div>
          <p className="services-intro">
            No rushed choices. Every appointment begins with a conversation about
            how you want to look, move, and feel.
          </p>
        </div>

        <div className="services-grid">
          {servicesList.map((service, index) => (
            <article key={service.title} className="service-card">
              <div className="service-meta"><span>0{index + 1}</span>{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <span className="service-rule" aria-hidden="true" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
