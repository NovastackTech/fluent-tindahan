import type { NavTab } from './Navigation';

/**
 * Home target for the header wordmark.
 * Signed-in stores go to the dashboard from every page, including the public landing page.
 * Visitors who are not signed in keep the public shortcut: landing, or login when already there.
 */
export function resolveHeaderLogoDestination(
  activeTab: NavTab | undefined,
  isOnboarded: boolean
): NavTab {
  if (isOnboarded) {
    return 'dashboard';
  }
  if (activeTab === 'landing') {
    return 'login';
  }
  return 'landing';
}
