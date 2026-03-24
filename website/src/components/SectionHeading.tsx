import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  children,
}: SectionHeadingProps) {
  const easeOut: Transition['ease'] = [0.22, 1, 0.36, 1];

  return (
    <motion.div
      className={`section-heading ${align === 'center' ? 'centered' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </motion.div>
  );
}
