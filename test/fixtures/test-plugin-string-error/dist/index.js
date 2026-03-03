// Test plugin that throws a non-Error value from handler
export function activate(context) {
  context.registerToolHandler('string_error_tool', async () => {
    throw 'raw string error';
  });
}
