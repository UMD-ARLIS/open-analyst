async function runAgentChat(_config, _messages, _options = {}) {
  return {
    text: "Chat endpoint is connected but the agent loop has not been ported to RR7 yet.",
    traces: [],
    toolCalls: []
  };
}
export {
  runAgentChat
};
