import { Keyboard, Locator, Page } from 'puppeteer';
import type { Browser } from 'puppeteer';

import { createLoggingProxy } from './logging-proxy.js';

export function withBrowserLogging(browser: Browser): Browser {
  return createLoggingProxy(browser, {
    name: 'browser',
    asyncMethods: ['newPage'],
    wrapResult: (value) =>
      value instanceof Page ? withPageLogging(value) : value,
  });
}

export function withPageLogging<T extends Pick<Page, 'goto'>>(page: T): T {
  return createLoggingProxy(page, {
    name: 'page',
    asyncMethods: ['goto'],
    wrapResult: (value, property) => {
      if (property === 'keyboard' && value instanceof Keyboard)
        return withKeyboardLogging(value);
      if (property === 'locator' && value instanceof Locator)
        return withLocatorLogging(value);
      return value;
    },
  });
}

export function withKeyboardLogging(keyboard: Keyboard): Keyboard {
  return createLoggingProxy(keyboard, {
    name: 'keyboard',
    asyncMethods: ['type', 'press'],
  });
}

export function withLocatorLogging<T>(locator: Locator<T>): Locator<T> {
  return createLoggingProxy(locator, {
    name: 'locator',
    asyncMethods: ['click', 'fill'],
    wrapResult: (value) =>
      value instanceof Locator ? withLocatorLogging(value) : value,
  });
}
