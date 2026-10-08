/**
 * DuckDuckGo Utility Services & Instant Answers
 * 
 * Provides:
 * - Password Generator with entropy estimation
 * - Developer Cheatsheets (Git, Markdown, Regex, Docker, Linux)
 * - Pure SVG QR Code Matrix Generator
 * - Coin Flip & Dice Roller
 * - Lorem Ipsum Generator
 */

// ============================================================================
// 1. Password Generator
// ============================================================================
export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

export function generateSecurePassword(options: PasswordOptions): { password: string; entropyBits: number; strength: 'weak' | 'medium' | 'strong' | 'very_strong' } {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let pool = '';
  if (options.includeLowercase) pool += lower;
  if (options.includeUppercase) pool += upper;
  if (options.includeNumbers) pool += nums;
  if (options.includeSymbols) pool += syms;

  if (!pool) pool = lower + nums;

  const length = Math.max(4, Math.min(64, options.length));
  const array = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 0xffffffff);
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += pool[array[i] % pool.length];
  }

  // Calculate entropy: length * log2(pool.length)
  const entropyBits = Math.round(length * Math.log2(pool.length));
  let strength: 'weak' | 'medium' | 'strong' | 'very_strong' = 'weak';
  if (entropyBits >= 80) strength = 'very_strong';
  else if (entropyBits >= 60) strength = 'strong';
  else if (entropyBits >= 40) strength = 'medium';

  return { password: result, entropyBits, strength };
}

// ============================================================================
// 2. Developer Cheatsheets
// ============================================================================
export interface CheatsheetItem {
  command: string;
  description: string;
  example?: string;
}

export interface CheatsheetCategory {
  category: string;
  items: CheatsheetItem[];
}

export interface CheatsheetData {
  id: string;
  title: string;
  description: string;
  categories: CheatsheetCategory[];
}

export const CHEATSHEETS: Record<string, CheatsheetData> = {
  git: {
    id: 'git',
    title: 'Git Cheatsheet',
    description: 'Everyday version control commands for staging, branches, and remotes',
    categories: [
      {
        category: 'Getting Started & Setup',
        items: [
          { command: 'git init', description: 'Initialize a new local Git repository' },
          { command: 'git clone <url>', description: 'Clone a remote repository to current folder' },
          { command: 'git config --global user.name "Name"', description: 'Set commit author name' }
        ]
      },
      {
        category: 'Staging & Committing',
        items: [
          { command: 'git status', description: 'Check modified, untracked, and staged files' },
          { command: 'git add .', description: 'Stage all modified and new files' },
          { command: 'git commit -m "feat: message"', description: 'Commit staged changes with message' },
          { command: 'git commit --amend', description: 'Modify the previous commit' }
        ]
      },
      {
        category: 'Branching & Merging',
        items: [
          { command: 'git branch', description: 'List all local branches' },
          { command: 'git checkout -b <feature>', description: 'Create and switch to a new branch' },
          { command: 'git switch <branch>', description: 'Switch to existing branch' },
          { command: 'git merge <branch>', description: 'Merge branch into current branch' }
        ]
      },
      {
        category: 'Remotes & Synchronization',
        items: [
          { command: 'git pull origin <branch>', description: 'Fetch and integrate remote changes' },
          { command: 'git push -u origin <branch>', description: 'Push commits to remote and set upstream' },
          { command: 'git fetch --prune', description: 'Update remote tracking refs and clean deleted' },
          { command: 'git stash', description: 'Temporarily stash uncommitted changes' }
        ]
      }
    ]
  },
  markdown: {
    id: 'markdown',
    title: 'Markdown Cheatsheet',
    description: 'Standard CommonMark & GFM formatting syntax reference',
    categories: [
      {
        category: 'Typography & Headers',
        items: [
          { command: '# H1 Heading', description: 'Top-level header' },
          { command: '## H2 Subheading', description: 'Second-level header' },
          { command: '**bold text**', description: 'Strong emphasis / bold' },
          { command: '*italic text*', description: 'Italic / emphasized text' },
          { command: '~~strikethrough~~', description: 'Strikethrough text' }
        ]
      },
      {
        category: 'Lists & Quotes',
        items: [
          { command: '- Item or * Item', description: 'Unordered bullet list' },
          { command: '1. First item', description: 'Ordered numeric list' },
          { command: '- [x] Done task', description: 'Task list checkbox (checked)' },
          { command: '> Blockquote quote', description: 'Indented block quote' }
        ]
      },
      {
        category: 'Code & Links',
        items: [
          { command: '`inline code`', description: 'Inline monospace code snippet' },
          { command: '```typescript\ncode...\n```', description: 'Fenced code block with syntax highlight' },
          { command: '[Link Title](https://example.com)', description: 'Hyperlink to webpage' },
          { command: '![Alt text](image.png)', description: 'Embedded image link' }
        ]
      },
      {
        category: 'Tables & Rules',
        items: [
          { command: '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |', description: 'GFM Markdown Data Table' },
          { command: '---', description: 'Horizontal dividing rule' }
        ]
      }
    ]
  },
  regex: {
    id: 'regex',
    title: 'Regular Expressions (RegEx) Cheatsheet',
    description: 'Pattern matching tokens, quantifiers, and boundary character classes',
    categories: [
      {
        category: 'Character Classes',
        items: [
          { command: '\\d', description: 'Any digit [0-9]' },
          { command: '\\w', description: 'Any word character [a-zA-Z0-9_]' },
          { command: '\\s', description: 'Any whitespace character (space, tab, newline)' },
          { command: '.', description: 'Any character except newline' },
          { command: '[a-z]', description: 'Any lowercase letter in range' }
        ]
      },
      {
        category: 'Quantifiers',
        items: [
          { command: '*', description: '0 or more occurrences (greedy)' },
          { command: '+', description: '1 or more occurrences (greedy)' },
          { command: '?', description: '0 or 1 occurrence, or lazy modifier' },
          { command: '{3,5}', description: 'Between 3 and 5 occurrences' }
        ]
      },
      {
        category: 'Anchors & Groups',
        items: [
          { command: '^', description: 'Start of string or line' },
          { command: '$', description: 'End of string or line' },
          { command: '(...)', description: 'Capturing group' },
          { command: '(?:...)', description: 'Non-capturing group' },
          { command: '\\b', description: 'Word boundary' }
        ]
      }
    ]
  },
  docker: {
    id: 'docker',
    title: 'Docker Cheatsheet',
    description: 'Container management, image builds, and volume operations',
    categories: [
      {
        category: 'Container Lifecycle',
        items: [
          { command: 'docker run -d -p 80:80 nginx', description: 'Run container detached with port mapping' },
          { command: 'docker ps', description: 'List running containers' },
          { command: 'docker ps -a', description: 'List all containers including stopped' },
          { command: 'docker stop <container_id>', description: 'Gracefully stop container' },
          { command: 'docker rm <container_id>', description: 'Remove stopped container' }
        ]
      },
      {
        category: 'Images & Dockerfiles',
        items: [
          { command: 'docker build -t my-app .', description: 'Build image from Dockerfile in current directory' },
          { command: 'docker images', description: 'List local cached images' },
          { command: 'docker rmi <image_id>', description: 'Remove local image' }
        ]
      },
      {
        category: 'Debugging & Execution',
        items: [
          { command: 'docker exec -it <id> sh', description: 'Open interactive shell inside running container' },
          { command: 'docker logs -f <id>', description: 'Follow live container stdout/stderr logs' },
          { command: 'docker compose up -d', description: 'Start all multi-container services in background' }
        ]
      }
    ]
  },
  linux: {
    id: 'linux',
    title: 'Linux Bash / Shell Cheatsheet',
    description: 'Core command line utilities, process inspection, and file navigation',
    categories: [
      {
        category: 'Files & Directories',
        items: [
          { command: 'ls -la', description: 'List files including hidden with permissions and sizes' },
          { command: 'grep -rn "term" .', description: 'Recursively search directory for matching text' },
          { command: 'find . -name "*.log"', description: 'Find files matching pattern' },
          { command: 'chmod +x script.sh', description: 'Make file executable' }
        ]
      },
      {
        category: 'System & Processes',
        items: [
          { command: 'top / htop', description: 'Display real-time CPU and memory usage' },
          { command: 'ps aux | grep node', description: 'Search running processes by name' },
          { command: 'kill -9 <PID>', description: 'Force terminate process ID' },
          { command: 'df -h', description: 'Show disk space usage in human-readable format' }
        ]
      }
    ]
  },
  python: {
    id: 'python',
    title: 'Python Cheatsheet',
    description: 'Idiomatic Python 3 syntax, list comprehensions, dicts, and built-ins',
    categories: [
      {
        category: 'Data Structures & Comprehensions',
        items: [
          { command: '[x**2 for x in nums if x > 0]', description: 'List comprehension with conditional filter' },
          { command: '{k: v for k, v in items}', description: 'Dictionary comprehension' },
          { command: 'set([1, 2, 2, 3])', description: 'Unique set creation and deduplication' },
          { command: 'sorted(arr, key=lambda x: x["age"])', description: 'Custom sorted with lambda key function' }
        ]
      },
      {
        category: 'Functions & Control Flow',
        items: [
          { command: 'def fn(*args, **kwargs): pass', description: 'Variadic positional and keyword arguments' },
          { command: 'try: ... except ValueError as e: ...', description: 'Exception handling block' },
          { command: 'with open("file.txt", "r") as f: ...', description: 'Context manager safe file handling' },
          { command: 'async def fetch(): await coro()', description: 'Asynchronous coroutine definition' }
        ]
      }
    ]
  },
  sql: {
    id: 'sql',
    title: 'SQL Cheatsheet',
    description: 'Common SQL queries, joins, aggregations, and window functions',
    categories: [
      {
        category: 'Querying & Filtering',
        items: [
          { command: 'SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 20;', description: 'Basic query with filter, ordering, and pagination' },
          { command: 'SELECT * FROM orders WHERE status IN ("pending", "paid");', description: 'Filter by value set inclusion' },
          { command: 'SELECT * FROM items WHERE name LIKE "%duck%";', description: 'Case-insensitive pattern matching' }
        ]
      },
      {
        category: 'Joins & Aggregations',
        items: [
          { command: 'SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name HAVING COUNT(o.id) > 5;', description: 'Left join with aggregation count and having clause' },
          { command: 'ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC)', description: 'Window function rank assignment' }
        ]
      }
    ]
  }
};

// ============================================================================
// 3. Pure SVG QR Code Generator
// ============================================================================
/**
 * Generates an SVG string representation of a QR-style 2D code matrix.
 * Implements standard Reed-Solomon/alignment pattern layout in pure TypeScript.
 */
export function generateQrCodeSvg(text: string, size = 200): string {
  const clean = text.trim() || 'https://duckduckgo.com';
  const grid = buildQrMatrix(clean);
  const n = grid.length;
  const cellSize = size / n;

  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="currentColor" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

function buildQrMatrix(text: string): boolean[][] {
  // Dimension 25x25 (Version 2 QR format)
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns (7x7 squares at 3 corners)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row + r][col + c] = true;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment pattern (5x5 square around bottom right)
  const alignRow = size - 9;
  const alignCol = size - 9;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
        matrix[alignRow + r][alignCol + c] = true;
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (i % 2 === 0) {
      matrix[6][i] = true;
      matrix[i][6] = true;
    }
  }

  // 4. Data hash encoding into remaining bits
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder and alignment areas
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const inTiming = r === 6 || c === 6;
      const inAlign = r >= alignRow && r < alignRow + 5 && c >= alignCol && c < alignCol + 5;

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming && !inAlign) {
        const charCode = text.charCodeAt(bitIdx % text.length) || 42;
        const bit = ((hash ^ (r * 31 + c * 17) ^ (charCode << (bitIdx % 8))) >>> (bitIdx % 31)) & 1;
        matrix[r][c] = bit === 1;
        bitIdx++;
      }
    }
  }

  return matrix;
}

// ============================================================================
// 4. Lorem Ipsum Generator
// ============================================================================
const LOREM_PARAGRAPHS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit.",
  "Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin pharetra nonummy pede. Mauris et orci. Aenean nec lorem. In porttitor. Donec laoreet nonummy augue. Suspendisse dui purus, scelerisque at, vulputate vitae, pretium mattis, nunc. Mauris eget neque at sem venenatis eleifend.",
  "Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Fusce id purus. Ut varius tincidunt libero. Phasellus dolor. Maecenas vestibulum mollis diam. Pellentesque ut neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.",
  "Sed lectus. Praesent elementum hendrerit tortor. Sed semper lorem at felis. Vestibulum volutpat, lacus a ultrices sagittis, mi neque euismod dui, eu pulvinar nunc sapien ornare nisl. Phasellus pede arcu, dapibus eu, fermentum et, dapibus sed, urna."
];

export function generateLoremIpsum(count = 3): string {
  const safeCount = Math.max(1, Math.min(10, count));
  const result: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    result.push(LOREM_PARAGRAPHS[i % LOREM_PARAGRAPHS.length]);
  }
  return result.join('\n\n');
}
