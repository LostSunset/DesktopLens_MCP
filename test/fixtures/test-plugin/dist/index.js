// Test plugin fixture for loader tests
export function activate(context) {
  context.registerToolHandler('my_tool', async (params) => ({
    content: [{ type: 'text', text: `Hello from test plugin! ${JSON.stringify(params)}` }],
  }));
  context.logger.debug('Debug message');
  context.logger.info('Test plugin activated');
  context.logger.warn('Warn message');
  context.logger.error('Error message');
}

export function deactivate() {
  // cleanup
}
