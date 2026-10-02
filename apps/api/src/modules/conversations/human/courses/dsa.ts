import type { Curriculum } from './types.js';

/** Data structures & algorithms, zero to interview-ready (in their language: JavaScript or Python). */
export const dsa: Curriculum = {
  id: 'dsa',
  name: 'DSA (data structures & algorithms)',
  match: /\b(dsa|data structures?|algorithms?|leetcode|competitive programming)\b/i,
  codeLang: 'python',
  docs: 'the CLRS book / NeetCode roadmap (free) for practice lists',
  before: 'one language through functions, arrays and objects/dictionaries (JavaScript or Python course, first levels)',
  levels: [
    {
      title: 'Foundations',
      lessons: [
        {
          title: 'What DSA is',
          topics: ['data structures vs algorithms in simple words', 'why interviews ask DSA', 'how to practise: understand → code → dry run → analyse', 'picking one language (JS or Python) for all of DSA'],
        },
        {
          title: 'Complexity',
          topics: ['Big-O: what it measures', 'O(1), O(log n), O(n), O(n log n), O(n²), O(2^n) with examples', 'time vs space complexity', 'best, average and worst case'],
        },
        {
          title: 'Maths and bits',
          topics: ['modulo, primes, GCD', 'counting digits, reversing numbers', 'binary numbers and bit operators (& | ^ << >>)', 'common bit tricks (odd/even, power of two)'],
        },
        {
          title: 'Recursion',
          topics: ['base case and recursive case', 'the call stack', 'recursion tree and its complexity', 'recursion vs iteration'],
        },
      ],
      project: 'solve 10 easy problems (sum of digits, palindrome number, fibonacci, power of two…) and state each Big-O',
    },
    {
      title: 'Linear structures',
      lessons: [
        {
          title: 'Arrays',
          topics: ['how arrays live in memory, dynamic arrays', 'traversal, insert, delete costs', 'prefix sums', 'Kadane’s algorithm (max subarray)'],
        },
        {
          title: 'Strings',
          topics: ['string building cost', 'anagrams, palindromes, reversal', 'character counting', 'substring problems'],
        },
        {
          title: 'Hashing',
          topics: ['hash maps and sets: how they work', 'frequency counting', 'two-sum and similar lookups', 'collisions (simply)'],
        },
        {
          title: 'Two pointers and sliding window',
          topics: ['two pointers on sorted arrays', 'fast and slow pointers', 'fixed-size sliding window', 'variable-size sliding window'],
        },
        {
          title: 'Linked lists',
          topics: ['nodes and pointers, singly vs doubly', 'insert, delete, reverse', 'cycle detection', 'merge two sorted lists, middle node'],
        },
        {
          title: 'Stacks and queues',
          topics: ['stack: push/pop, valid parentheses', 'queue and deque', 'monotonic stack (next greater element)', 'implementing a queue with stacks'],
        },
      ],
      project: 'solve 25 problems across arrays, hashing, two pointers, sliding window, linked lists and stacks',
    },
    {
      title: 'Searching and sorting',
      lessons: [
        {
          title: 'Searching',
          topics: ['linear search', 'binary search (and its off-by-one traps)', 'binary search on the answer', 'search in rotated arrays'],
        },
        {
          title: 'Sorting',
          topics: ['bubble, selection, insertion sort', 'merge sort', 'quick sort', 'counting sort, stability and built-in sorts'],
        },
      ],
      project: 'implement every sort yourself and compare their speed on 10,000 numbers',
    },
    {
      title: 'Trees and graphs',
      lessons: [
        {
          title: 'Binary trees',
          topics: ['tree vocabulary (root, leaf, height, depth)', 'DFS traversals: preorder, inorder, postorder', 'BFS level order', 'height, diameter, balanced check'],
        },
        {
          title: 'Binary search trees',
          topics: ['BST property', 'search, insert, delete', 'validate a BST', 'lowest common ancestor'],
        },
        {
          title: 'Heaps',
          topics: ['min/max heap and priority queue', 'heapify, push, pop', 'top-k problems', 'merge k sorted lists'],
        },
        {
          title: 'Graphs',
          topics: ['adjacency list vs matrix', 'BFS and DFS on graphs', 'connected components and cycle detection', 'topological sort'],
        },
        {
          title: 'Shortest paths and spanning trees',
          topics: ['shortest path in unweighted graphs (BFS)', 'Dijkstra', 'union-find (disjoint set)', 'minimum spanning tree (Kruskal / Prim)'],
        },
        {
          title: 'Tries',
          topics: ['trie structure', 'insert and search words', 'prefix search / autocomplete'],
        },
      ],
      project: 'solve 25 tree and graph problems, including a grid BFS (islands) and a course-schedule topological sort',
    },
    {
      title: 'Problem-solving techniques',
      lessons: [
        {
          title: 'Backtracking',
          topics: ['the choose / explore / un-choose template', 'subsets and permutations', 'combination sum', 'N-Queens / sudoku idea'],
        },
        {
          title: 'Greedy',
          topics: ['when greedy works (and a counter-example)', 'interval scheduling, merge intervals', 'jump game, gas station'],
        },
        {
          title: 'Dynamic programming',
          topics: ['overlapping subproblems and memoization', 'tabulation (bottom-up)', '1D DP: climbing stairs, house robber', '2D DP: grid paths, LCS, edit distance', 'knapsack patterns'],
        },
      ],
      project: 'solve 20 problems: 5 backtracking, 5 greedy, 10 DP — explain each approach out loud',
    },
    {
      title: 'Interview ready',
      lessons: [
        {
          title: 'Interview method',
          topics: ['clarify → examples → brute force → optimise → code → test', 'talking while you code', 'testing edge cases (empty, one item, duplicates, negatives)', 'stating time and space complexity'],
        },
        {
          title: 'Patterns review',
          topics: ['recognising the pattern from the question', 'a mixed set of timed problems', 'a weekly mock interview plan'],
        },
      ],
      project: 'final: 3 timed mock interviews with Dev, plus a list of 150 classic problems with your progress tracked',
    },
  ],
};
