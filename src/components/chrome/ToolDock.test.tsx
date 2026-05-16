import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolDock } from './ToolDock';

describe('ToolDock', () => {
  it('creates an OmniScript node from the add menu', () => {
    const onCreate = vi.fn();
    render(<ToolDock onCreate={onCreate} />);

    fireEvent.click(screen.getByTitle('Add'));
    fireEvent.click(screen.getByText('OmniScript'));

    expect(onCreate).toHaveBeenCalledWith('omniscript');
  });

  it('creates a planning node from the add menu', () => {
    const onCreate = vi.fn();
    render(<ToolDock onCreate={onCreate} />);

    fireEvent.click(screen.getByTitle('Add'));
    fireEvent.click(screen.getByText('企划节点'));

    expect(onCreate).toHaveBeenCalledWith('planning');
  });
});
