// Test plugin that throws from handler
export function activate(context) {
  context.registerToolHandler('error_tool', async () => {
    throw new Error('Handler exploded');
  });
}
