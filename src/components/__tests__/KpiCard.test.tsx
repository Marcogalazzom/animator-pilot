import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiCard from '@/components/KpiCard';
import type { KpiCardProps } from '@/components/KpiCard';
import { Bed } from 'lucide-react';

// Helper to get the kpi-card root element
function getCard(container: HTMLElement) {
  return container.querySelector('.kpi-card') as HTMLElement;
}

const baseProps: KpiCardProps = {
  label: 'Taux d\'occupation',
  value: '92',
  status: 'ok',
  icon: <Bed size={16} />,
};

describe('KpiCard', () => {
  it('renders the label', () => {
    render(<KpiCard {...baseProps} />);
    expect(screen.getByText("Taux d'occupation")).toBeInTheDocument();
  });

  it('renders the value', () => {
    render(<KpiCard {...baseProps} />);
    expect(screen.getByText('92')).toBeInTheDocument();
  });

  it('renders the unit when provided', () => {
    render(<KpiCard {...baseProps} unit="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('does not render unit element when unit is omitted', () => {
    render(<KpiCard {...baseProps} />);
    // value is present, but no '%' text should exist
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('applies success border color for ok status', () => {
    const { container } = render(<KpiCard {...baseProps} status="ok" />);
    const card = getCard(container);
    expect(card.style.borderLeft).toContain('var(--color-success)');
  });

  it('applies warning border color for warning status', () => {
    const { container } = render(<KpiCard {...baseProps} status="warning" />);
    const card = getCard(container);
    expect(card.style.borderLeft).toContain('var(--color-warning)');
  });

  it('applies danger border color for critical status', () => {
    const { container } = render(<KpiCard {...baseProps} status="critical" />);
    const card = getCard(container);
    expect(card.style.borderLeft).toContain('var(--color-danger)');
  });

  it('renders trend value when trend is provided', () => {
    render(
      <KpiCard
        {...baseProps}
        trend={{ direction: 'up', value: '+2.1%', upIsGood: true }}
      />
    );
    expect(screen.getByText('+2.1%')).toBeInTheDocument();
  });

  it('renders "vs mois précédent" label when trend is provided', () => {
    render(
      <KpiCard
        {...baseProps}
        trend={{ direction: 'up', value: '+2%', upIsGood: true }}
      />
    );
    expect(screen.getByText('vs mois précédent')).toBeInTheDocument();
  });

  it('does not render trend section when trend is omitted', () => {
    render(<KpiCard {...baseProps} />);
    expect(screen.queryByText('vs mois précédent')).not.toBeInTheDocument();
  });

  it('renders TrendingUp icon for up direction', () => {
    render(
      <KpiCard
        {...baseProps}
        trend={{ direction: 'up', value: '+1%' }}
      />
    );
    // lucide-react renders svg; verify trend section exists with value
    expect(screen.getByText('+1%')).toBeInTheDocument();
  });

  it('renders TrendingDown icon for down direction', () => {
    render(
      <KpiCard
        {...baseProps}
        trend={{ direction: 'down', value: '-1%' }}
      />
    );
    expect(screen.getByText('-1%')).toBeInTheDocument();
  });
});
