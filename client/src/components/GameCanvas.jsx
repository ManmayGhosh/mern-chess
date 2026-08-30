export default function GameCanvas({ canvasRef }) {
  return <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />;
}
