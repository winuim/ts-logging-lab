import { Keyboard, Locator, Page } from 'puppeteer';
import type { Browser } from 'puppeteer';

import type { LogOptions } from './log-event.js';
import { createLoggingProxy } from './logging-proxy.js';

export function withBrowserLogging(
  browser: Browser,
  options: LogOptions = {},
): Browser {
  return createLoggingProxy(browser, {
    ...options,
    name: 'browser',
    asyncMethods: ['newPage'],
    wrapResult: (value) =>
      value instanceof Page ? withPageLogging(value, options) : value,
  });
}

export function withPageLogging<T extends Pick<Page, 'goto'>>(
  page: T,
  options: LogOptions = {},
): T {
  return createLoggingProxy(page, {
    ...options,
    name: 'page',
    asyncMethods: ['goto'],
    wrapResult: (value, property) => {
      if (property === 'keyboard' && value instanceof Keyboard)
        return withKeyboardLogging(value, options);
      if (property === 'locator' && value instanceof Locator)
        return withLocatorLogging(value, options);
      return value;
    },
  });
}

export function withKeyboardLogging(
  keyboard: Keyboard,
  options: LogOptions = {},
): Keyboard {
  return createLoggingProxy(keyboard, {
    ...options,
    name: 'keyboard',
    asyncMethods: ['type', 'press'],
  });
}

export function withLocatorLogging<T>(
  locator: Locator<T>,
  options: LogOptions = {},
): Locator<T> {
  return createLoggingProxy(locator, {
    ...options,
    name: 'locator',
    asyncMethods: ['click', 'fill'],
    wrapResult: (value) =>
      value instanceof Locator ? withLocatorLogging(value, options) : value,
  });
}
