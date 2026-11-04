// ===== L'ordi réfléchit ici, en arrière-plan, pour que les animations restent fluides =====

importScripts("engine.js", "ai.js");

self.onmessage = (e) => {
  const { id, cmd, args } = e.data;
  let result = null;
  switch (cmd) {
    case "move": result = C4AI.chooseMove(args.state, args.level, args.msCap); break;
    case "hint": result = C4AI.hint(args.state, args.ms); break;
    case "analyze": result = C4AI.analyze(args.state, args.ms, args.must); break;
    case "simulate": result = C4AI.simulate(args.options, args.starter, args.levels, args.msCap); break;
  }
  self.postMessage({ id, result });
};
