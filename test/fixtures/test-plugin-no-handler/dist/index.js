// Test plugin that doesn't register handlers
export function activate(context) {
  context.logger.info('Plugin activated but no handlers registered');
}
