export function isReachEnabled(): boolean {
  return process.env.ENABLE_REACH !== 'false';
}
