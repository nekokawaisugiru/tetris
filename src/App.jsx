import { useEffect, useRef, useState, useCallback } from "react";

// --- 定数 ---
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const NORMAL_DROP = 500; // 通常落下
const FAST_DROP = 30; // ↓キー押下中の落下

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const randomPiece = () => {
  const keys = Object.keys(SHAPES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return {
    shape: SHAPES[key],
    x: Math.floor(COLS / 2) - 1,
    y: 0,
  };
};

const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800, // テトリス！
};

const rotate = (matrix) =>
  matrix[0].map((_, i) => matrix.map((r) => r[i]).reverse());

const emptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export default function App() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);

  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [nextPiece, setNextPiece] = useState(randomPiece);
  const [gameOver, setGameOver] = useState(false);
  const [fast, setFast] = useState(false);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);

  // --- 当たり判定 ---
  const collide = (p, b) => {
    return p.shape.some((row, dy) =>
      row.some((val, dx) => {
        if (!val) return false;
        const x = p.x + dx;
        const y = p.y + dy;
        return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && b[y][x]);
      })
    );
  };

  // --- ボードに固定 ---
  const merge = (p, b) => {
    const newBoard = b.map((r) => [...r]);
    p.shape.forEach((row, dy) =>
      row.forEach((val, dx) => {
        if (val && p.y + dy >= 0) {
          newBoard[p.y + dy][p.x + dx] = 1;
        }
      })
    );
    return newBoard;
  };

  // --- ゴーストピース ---
  const getGhostPiece = useCallback((piece, board) => {
    let ghost = { ...piece };

    while (!collide({ ...ghost, y: ghost.y + 1 }, board)) {
      ghost.y++;
    }

    return ghost;
  }, []);

  // --- ライン消去 ---
  const clearLines = (board) => {
    const remaining = board.filter((row) => row.some((cell) => !cell));
    const cleared = ROWS - remaining.length;

    const emptyRows = Array.from({ length: cleared }, () =>
      Array(COLS).fill(0)
    );

    return {
      board: emptyRows.concat(remaining),
      cleared,
    };
  };

  // --- 落下 ---
  const drop = useCallback(() => {
    const moved = { ...piece, y: piece.y + 1 };

    if (!collide(moved, board)) {
      setPiece(moved);
    } else {
      const merged = merge(piece, board);
      const { board: newBoard, cleared } = clearLines(merged);

      const spawn = {
        ...nextPiece,
        x: Math.floor(COLS / 2) - 1,
        y: 0,
      };

      if (collide(spawn, newBoard)) {
        setGameOver(true);
        return;
      }

      if (cleared > 0) {
        setScore((s) => s + (SCORE_TABLE[cleared] || 0) * level);
        setLines((l) => {
          const total = l + cleared;
          setLevel(Math.floor(total / 10) + 1);
          return total;
        });
      }

      setBoard(newBoard);
      setPiece(spawn);
      setNextPiece(randomPiece());
    }
  }, [piece, board, nextPiece, level]);

  // --- 左右移動 ---
  const move = (dx) => {
    const moved = { ...piece, x: piece.x + dx };
    if (!collide(moved, board)) {
      setPiece(moved);
    }
  };

  // --- 回転 ---
  const rotatePiece = () => {
    const rotated = { ...piece, shape: rotate(piece.shape) };
    if (!collide(rotated, board)) {
      setPiece(rotated);
    }
  };

  // --- 自動落下（速度切替） ---
  useEffect(() => {
    const speed = fast
      ? FAST_DROP
      : Math.max(100, NORMAL_DROP - (level - 1) * 50);
    const id = setInterval(() => {
      if (!gameOver) drop();
    }, speed);

    return () => clearInterval(id);
  }, [fast, gameOver, level, drop]);

  // --- キー操作 ---
  useEffect(() => {
    const onKeyDown = (e) => {
      if (gameOver) return;
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowDown") setFast(true);
      if (e.key === "ArrowUp") rotatePiece();
    };

    const onKeyUp = (e) => {
      if (e.key === "ArrowDown") setFast(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // --- 描画 ---
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    const ghost = getGhostPiece(piece, board);
    ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    const drawCell = (x, y) => {
      ctx.save();
      ctx.fillStyle = "#4d6d4fff";
      ctx.shadowColor = "#b4ee7eff";
      ctx.shadowBlur = 8;

      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      ctx.restore();
    };

    ghost.shape.forEach((row, dy) =>
      row.forEach((v, dx) => {
        if (!v) return;

        ctx.save();
        ctx.fillStyle = "rgba(180, 238, 126, 0.25)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;

        ctx.fillRect(
          (ghost.x + dx) * BLOCK,
          (ghost.y + dy) * BLOCK,
          BLOCK,
          BLOCK
        );
        ctx.strokeRect(
          (ghost.x + dx) * BLOCK,
          (ghost.y + dy) * BLOCK,
          BLOCK,
          BLOCK
        );
        ctx.restore();
      })
    );

    board.forEach((row, y) => row.forEach((v, x) => v && drawCell(x, y)));

    piece.shape.forEach((row, dy) =>
      row.forEach((v, dx) => v && drawCell(piece.x + dx, piece.y + dy))
    );
  }, [board, piece, getGhostPiece]);

  useEffect(() => {
    const ctx = nextCanvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, 4 * BLOCK, 4 * BLOCK);

    const shape = nextPiece.shape;
    const h = shape.length;
    const w = shape[0].length;

    const offsetX = Math.floor((4 - w) / 2);
    const offsetY = Math.floor((4 - h) / 2);

    shape.forEach((row, y) =>
      row.forEach((v, x) => {
        if (!v) return;

        ctx.fillStyle = "#858d57ff";
        ctx.fillRect(
          (x + offsetX) * BLOCK,
          (y + offsetY) * BLOCK,
          BLOCK,
          BLOCK
        );

        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(
          (x + offsetX) * BLOCK,
          (y + offsetY) * BLOCK,
          BLOCK,
          BLOCK
        );
      })
    );
  }, [nextPiece]);

  return (
    <div className="h-[900px] w-[900px] overflow-hidden bg-gray-900 text-white">
      <div className="flex h-full items-center justify-center">
        <div className="relative flex items-center gap-2">
          <h1 className="text-xl font-bold m-8">Tetris</h1>
          {gameOver && <p className="text-red-400">Game Over</p>}

          <div className="p-2 rounded-xl border-2 border-cyan-400 shadow-[0_0_10px_#22d3ee,0_0_30px_#22d3ee]">
            <canvas
              ref={canvasRef}
              width={COLS * BLOCK}
              height={ROWS * BLOCK}
            />
          </div>
          <div className="flex flex-col items-center gap-1 m-8">
            <span className="text-xl text-cyan-300">NEXT</span>
            <canvas
              ref={nextCanvasRef}
              width={4 * BLOCK}
              height={4 * BLOCK}
              className="border border-white/30"
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-sm text-cyan-200">
            <div>Score: {score}</div>
            <div>Lines: {lines}</div>
            <div>Level: {level}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
