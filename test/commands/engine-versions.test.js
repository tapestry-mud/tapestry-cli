'use strict';

jest.mock('node-fetch');
const fetch = require('node-fetch');
const { engineVersions } = require('../../src/commands/engine-versions');

beforeEach(() => {
  fetch.mockReset();
});

describe('engineVersions', () => {
  it('prints a table with Channel, Version, Updated headers', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { channel: 'nightly', version: 'edge',  docker_tag: 'edge',  updated_at: '2026-05-12T10:55:00Z' },
        { channel: 'stable',  version: '0.0.5', docker_tag: '0.0.5', updated_at: '2026-05-11T09:12:00Z' },
        { channel: '0.0.5',   version: '0.0.5', docker_tag: '0.0.5', updated_at: '2026-05-11T09:12:00Z' },
      ]),
    });

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await engineVersions();

    const lines = spy.mock.calls.map(c => c[0]).join('\n');
    expect(lines).toContain('Channel');
    expect(lines).toContain('Version');
    expect(lines).toContain('Updated');
    expect(lines).toContain('nightly');
    expect(lines).toContain('stable');
    expect(lines).toContain('0.0.5');
    expect(lines).toContain('edge');
    spy.mockRestore();
  });

  it('calls GET /engine-channels on the registry URL', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await engineVersions();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/engine-channels'));
    spy.mockRestore();
  });

  it('prints message when no channels are registered', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await engineVersions();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No engine channels');
    spy.mockRestore();
  });

  it('throws when registry returns an error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(engineVersions()).rejects.toThrow('Registry error 500');
  });
});
