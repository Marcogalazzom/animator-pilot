import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertBanner from '@/components/AlertBanner';
import type { AlertItem } from '@/components/AlertBanner';

const warningAlert: AlertItem = {
  indicator: 'taux_occupation',
  value: 83,
  threshold: 85,
  severity: 'warning',
};

const criticalAlert: AlertItem = {
  indicator: 'taux_absenteisme',
  value: 14,
  threshold: 12,
  severity: 'critical',
};

describe('AlertBanner', () => {
  it('returns null when alerts array is empty', () => {
    const { container } = render(<AlertBanner alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the alert role element when alerts exist', () => {
    render(<AlertBanner alerts={[warningAlert]} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders "Attention" heading for warning-only alerts', () => {
    render(<AlertBanner alerts={[warningAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('Attention');
  });

  it('renders "Alerte critique" heading when a critical alert is present', () => {
    render(<AlertBanner alerts={[criticalAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('Alerte critique');
  });

  it('shows "Alerte critique" even when mixed with warnings', () => {
    render(<AlertBanner alerts={[warningAlert, criticalAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('Alerte critique');
  });

  it('shows indicator count in the message', () => {
    render(<AlertBanner alerts={[warningAlert, criticalAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('2');
  });

  it('uses singular form for a single alert', () => {
    render(<AlertBanner alerts={[warningAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('indicateur');
    // Should NOT contain "indicateurs" (plural)
    expect(text).not.toContain('indicateurs');
  });

  it('uses plural form for multiple alerts', () => {
    render(<AlertBanner alerts={[warningAlert, criticalAlert]} />);
    const text = screen.getByRole('alert').textContent;
    expect(text).toContain('indicateurs');
  });

  it('renders human-readable label for known indicator', () => {
    render(<AlertBanner alerts={[warningAlert, criticalAlert]} />);
    // taux_occupation → "Taux d'occupation"
    expect(screen.getByRole('alert').textContent).toContain("Taux d'occupation");
  });

  it('falls back to raw indicator key for unknown indicator', () => {
    const unknownAlert: AlertItem = {
      indicator: 'unknown_indicator',
      value: 5,
      threshold: 3,
      severity: 'warning',
    };
    render(<AlertBanner alerts={[warningAlert, unknownAlert]} />);
    expect(screen.getByRole('alert').textContent).toContain('unknown_indicator');
  });

  it('uses warning border color for warning-only mode', () => {
    const { container } = render(<AlertBanner alerts={[warningAlert]} />);
    const alertEl = container.querySelector('[role="alert"]') as HTMLElement;
    // The border style should reference the warning color
    expect(alertEl.style.borderLeft).toContain('var(--color-warning)');
  });

  it('uses danger border color for critical mode', () => {
    const { container } = render(<AlertBanner alerts={[criticalAlert]} />);
    const alertEl = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alertEl.style.borderLeft).toContain('var(--color-danger)');
  });
});
