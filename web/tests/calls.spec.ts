import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const testKey = process.env.PHONEAPP_BROWSER_URL
  ? process.env.POC_ACCESS_KEY!
  : 'browser-test-only-key-not-for-real-use';
async function peers(browser: Browser, baseURL: string) {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      viewport: { width: 1280, height: 900 },
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(baseURL);
    pages.push(page);
  }
  return {
    a: pages[0],
    b: pages[1],
    close: () => Promise.all(contexts.map((context) => context.close())),
  };
}
async function create(a: Page) {
  await a.locator('#create-tab').click();
  await a.locator('#access-key').fill(testKey);
  await a.locator('#create').click();
  await expect(a.locator('#notice')).toContainText('Invitation ready');
  return await a.locator('#invitation').inputValue();
}
async function connect(a: Page, b: Page, relay = false, audioFirst = false) {
  const code = await create(a);
  await b.locator('#join-tab').click();
  await b.locator('#invitation').fill(code);
  if (audioFirst) await a.locator('#video').uncheck();
  if (relay) {
    for (const page of [a, b]) {
      await page.locator('.diagnostics > summary').click();
      await page.locator('#relay').check();
    }
  }
  await a.locator('#join').click();
  await expect(a.locator('body')).toHaveAttribute('data-state', 'waiting');
  await b.locator('#join').click();
  for (const page of [a, b]) {
    await expect(page.locator('body')).toHaveAttribute(
      'data-state',
      'connected',
    );
    if (await page.locator('#play-audio').isVisible())
      await page.locator('#play-audio').click();
    await expect
      .poll(() =>
        page.locator('#received').getAttribute('data-bytes').then(Number),
      )
      .toBeGreaterThan(1024);
  }
}

test('video call receives real synthetic media, controls work, and another call succeeds', async ({
  browser,
  baseURL,
}) => {
  const p = await peers(browser, baseURL!);
  try {
    await connect(p.a, p.b);
    for (const page of [p.a, p.b]) {
      await expect
        .poll(() =>
          page
            .locator('#remote')
            .evaluate((v) => (v as HTMLVideoElement).videoWidth),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          page
            .locator('#remote')
            .evaluate((v) => (v as HTMLVideoElement).currentTime),
        )
        .toBeGreaterThan(0.1);
    }
    await p.a.locator('#mute').click();
    expect(
      await p.a
        .locator('#local')
        .evaluate(
          (v) =>
            (
              (v as HTMLVideoElement).srcObject as MediaStream
            ).getAudioTracks()[0].enabled,
        ),
    ).toBe(false);
    await p.a.locator('#camera').click();
    expect(
      await p.a
        .locator('#local')
        .evaluate(
          (v) =>
            (
              (v as HTMLVideoElement).srcObject as MediaStream
            ).getVideoTracks()[0].enabled,
        ),
    ).toBe(false);
    // Retain references to prove capture actually stops after UI clears its streams.
    await p.a.locator('#local').evaluate((v) => {
      (window as unknown as { testTracks: MediaStreamTrack[] }).testTracks = (
        (v as HTMLVideoElement).srcObject as MediaStream
      ).getTracks();
    });
    await p.a.locator('#hangup').click();
    await expect(p.a.locator('body')).toHaveAttribute('data-state', 'ended');
    await expect(p.b.locator('body')).toHaveAttribute('data-state', 'ended');
    expect(
      await p.a.evaluate(() =>
        (
          window as unknown as { testTracks: MediaStreamTrack[] }
        ).testTracks.every((t) => t.readyState === 'ended'),
      ),
    ).toBe(true);
    await expect(p.a.locator('#elapsed')).not.toHaveText('00:00');
    await connect(p.a, p.b);
    await p.b.locator('#hangup').click();
    await expect(p.a.locator('body')).toHaveAttribute('data-state', 'ended');
  } finally {
    await p.close();
  }
});

test('forced TURN relay exchanges media and reports relay candidates', async ({
  browser,
  baseURL,
  request,
}) => {
  const health = await (await request.get(`${baseURL}/health`)).json();
  test.skip(
    !health.turnConfigured,
    'Requires configured TURN service and reachable relay ports',
  );
  const p = await peers(browser, baseURL!);
  try {
    await connect(p.a, p.b, true);
    for (const page of [p.a, p.b])
      await expect(page.locator('#path')).toContainText('relay → relay');
    await p.a.locator('#hangup').click();
  } finally {
    await p.close();
  }
});

test('audio-only initiator can receive video from the second participant', async ({
  browser,
  baseURL,
}) => {
  const p = await peers(browser, baseURL!);
  try {
    await connect(p.a, p.b, false, true);
    expect(
      await p.a
        .locator('#local')
        .evaluate(
          (v) =>
            ((v as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()
              .length,
        ),
    ).toBe(0);
    await expect
      .poll(() =>
        p.a
          .locator('#remote')
          .evaluate((v) => (v as HTMLVideoElement).videoWidth),
      )
      .toBeGreaterThan(0);
    await expect(p.a.locator('#camera')).toBeDisabled();
    await p.a.locator('#hangup').click();
  } finally {
    await p.close();
  }
});

test('bad key and invalid room recover without leaving capture active', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('#access-key')
    .fill('wrong-key-that-is-long-enough-for-validation');
  await page.locator('#create').click();
  await expect(page.locator('#error')).toContainText(
    'Test access key required',
  );
  await page.locator('#invitation').fill(`${'x'.repeat(12)}.${'y'.repeat(32)}`);
  await page.locator('#join').click();
  await expect(page.locator('#error')).toContainText('invalid or expired');
  await expect(page.locator('#local-preview')).toBeHidden();
  expect(
    await page
      .locator('#local')
      .evaluate((v) => (v as HTMLVideoElement).srcObject),
  ).toBeNull();
  await expect(page.locator('#join')).toBeEnabled();
});

test('blocked autoplay offers a playback button that resumes remote video', async ({
  browser,
  baseURL,
}) => {
  const p = await peers(browser, baseURL!);
  try {
    await p.a.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      let allowed = false;
      document.addEventListener(
        'click',
        (event) => {
          if ((event.target as Element).closest('#play-audio')) allowed = true;
        },
        true,
      );
      HTMLMediaElement.prototype.play = function () {
        if (this.id === 'remote' && !allowed)
          return Promise.reject(
            new DOMException('Test autoplay block', 'NotAllowedError'),
          );
        return play.call(this);
      };
    });
    await p.a.reload();
    const code = await create(p.a);
    await p.b.locator('#join-tab').click();
    await p.b.locator('#invitation').fill(code);
    await p.a.locator('#join').click();
    await expect(p.a.locator('body')).toHaveAttribute('data-state', 'waiting');
    await p.b.locator('#join').click();
    await expect(p.a.locator('body')).toHaveAttribute(
      'data-state',
      'connected',
    );
    await expect(p.a.locator('#play-audio')).toBeVisible();
    await p.a.locator('#play-audio').click();
    await expect(p.a.locator('#play-audio')).toBeHidden();
    await expect
      .poll(() =>
        p.a
          .locator('#remote')
          .evaluate((v) => (v as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0.1);
    await p.a.locator('#hangup').click();
  } finally {
    await p.close();
  }
});

test('permission denial gives a recovery message and invitation link is removed from URL', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Test denied', 'NotAllowedError'));
  });
  await page.goto(`/#invite=${'x'.repeat(12)}.${'y'.repeat(32)}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#creator-pane')).toBeHidden();
  await page.locator('#join').click();
  await expect(page.locator('#error')).toContainText('access was denied');
  await expect(page.locator('#join')).toBeEnabled();
});

test('layout fits desktop, iPad portrait, and narrow phone widths', async ({
  page,
}) => {
  await page.goto('/');
  await mkdir('artifacts/private', { recursive: true });
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('#join')).toBeVisible();
    await page.screenshot({
      path: `artifacts/private/browser-${width}.png`,
      fullPage: true,
    });
  }
});
