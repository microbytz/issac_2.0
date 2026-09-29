import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import {
  FolderTree,
  GitFork,
  Tag,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Sliders,
  Download,
  ExternalLink,
  Edit3,
  Check,
  X,
  Layers,
  Sparkles,
  Info,
  Network
} from 'lucide-react';
import { PageItem } from '../utils/collectionExport';

export interface TagHierarchyNode {
  id: string;
  name: string;
  tag?: string; // The tag string if it maps to a real catalog tag
  count: number; // Number of pages directly matching this tag
  totalCount: number; // Cumulative page count including children
  depth?: number;
  children?: TagHierarchyNode[];
  _children?: TagHierarchyNode[];
  isCustomCategory?: boolean;
}

interface TagHierarchyTreeProps {
  pages: PageItem[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onRenameTag?: (oldTag: string, newTag: string) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  className?: string;
  isExpandedView?: boolean;
  onToggleExpandView?: () => void;
  isLight?: boolean;
}

// Initial semantic default hierarchy relationships for crawler domain
const DEFAULT_PARENT_MAPPINGS: Record<string, string> = {
  'fastapi': 'python',
  'whoosh': 'search-engine',
  'indexing': 'search-engine',
  'firestore': 'database',
  'nosql': 'database',
  'firebase': 'cloud',
  'backend': 'api',
  'documentation': 'api',
};

// Initial Category assignments for top-level tags
const DEFAULT_CATEGORY_GROUPS: Record<string, string> = {
  'python': 'Development',
  'api': 'Development',
  'database': 'Data Storage',
  'cloud': 'Infrastructure',
  'search-engine': 'Search & Retrieval',
};

const STORAGE_KEY_RELATIONSHIPS = 'crawler_tag_hierarchy_relationships_v2';
const STORAGE_KEY_CATEGORIES = 'crawler_tag_hierarchy_categories_v2';

export const TagHierarchyTree: React.FC<TagHierarchyTreeProps> = ({
  pages,
  selectedTag,
  onSelectTag,
  onRenameTag,
  onNotify,
  className = '',
  isExpandedView = false,
  onToggleExpandView,
  isLight = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Layout & Display Controls
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [inspectedNode, setInspectedNode] = useState<TagHierarchyNode | null>(null);
  const [isReparentModalOpen, setIsReparentModalOpen] = useState<boolean>(false);
  const [reparentTargetTag, setReparentTargetTag] = useState<string>('');
  const [reparentNewParent, setReparentNewParent] = useState<string>('__none__');

  // Custom user-defined parent-child mappings
  const [parentMappings, setParentMappings] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RELATIONSHIPS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PARENT_MAPPINGS;
  });

  // Save parent mappings to localStorage
  const updateParentMappings = (newMappings: Record<string, string>) => {
    setParentMappings(newMappings);
    try {
      localStorage.setItem(STORAGE_KEY_RELATIONSHIPS, JSON.stringify(newMappings));
    } catch {
      // ignore
    }
  };

  // Extract all unique tags and count their page usages
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pages.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          const clean = t.trim().toLowerCase();
          if (clean) counts[clean] = (counts[clean] || 0) + 1;
        });
      }
    });
    return counts;
  }, [pages]);

  const uniqueTagsList = useMemo(() => {
    return Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  }, [tagCounts]);

  // Construct the hierarchical data structure
  const rawHierarchyData = useMemo<TagHierarchyNode>(() => {
    // Collect all tags
    const allTags = new Set<string>(uniqueTagsList);
    // Include tags referenced in parentMappings
    Object.keys(parentMappings).forEach(t => allTags.add(t));
    Object.values(parentMappings).forEach((t: string) => {
      if (t && typeof t === 'string' && t !== '__none__' && !t.startsWith('category:')) allTags.add(t);
    });

    // Map of nodes by tag or category
    const nodesMap = new Map<string, TagHierarchyNode>();

    // 1. Initialize nodes for all tags
    allTags.forEach(tag => {
      const count = tagCounts[tag] || 0;
      nodesMap.set(tag, {
        id: `tag:${tag}`,
        name: tag,
        tag: tag,
        count: count,
        totalCount: count,
        children: []
      });
    });

    // 2. Identify parent-child connections
    // Children set to identify root nodes
    const hasParent = new Set<string>();

    allTags.forEach(tag => {
      // Check path delimiter first (e.g. "tech/ai" or "cloud:aws")
      let parentTag = parentMappings[tag];
      if (!parentTag) {
        if (tag.includes('/')) {
          const parts = tag.split('/');
          parentTag = parts[parts.length - 2];
        } else if (tag.includes(':')) {
          const parts = tag.split(':');
          parentTag = parts[0];
        }
      }

      if (parentTag && parentTag !== '__none__' && parentTag !== tag) {
        // Ensure parent node exists
        if (!nodesMap.has(parentTag)) {
          const pCount = tagCounts[parentTag] || 0;
          nodesMap.set(parentTag, {
            id: `tag:${parentTag}`,
            name: parentTag,
            tag: parentTag,
            count: pCount,
            totalCount: pCount,
            children: []
          });
        }

        const parentNode = nodesMap.get(parentTag)!;
        const currentNode = nodesMap.get(tag)!;

        // Prevent circular dependencies
        const isDescendant = (node: TagHierarchyNode, targetId: string): boolean => {
          if (node.id === targetId) return true;
          return (node.children || []).some(child => isDescendant(child, targetId));
        };

        if (!isDescendant(currentNode, parentNode.id)) {
          parentNode.children = parentNode.children || [];
          if (!parentNode.children.some(c => c.id === currentNode.id)) {
            parentNode.children.push(currentNode);
            hasParent.add(tag);
          }
        }
      }
    });

    // 3. Category nodes grouping top-level roots
    const categoryMap = new Map<string, TagHierarchyNode>();
    const topLevelNodes: TagHierarchyNode[] = [];

    allTags.forEach(tag => {
      if (!hasParent.has(tag)) {
        const node = nodesMap.get(tag)!;
        const category = DEFAULT_CATEGORY_GROUPS[tag];
        if (category) {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              id: `cat:${category}`,
              name: category,
              count: 0,
              totalCount: 0,
              isCustomCategory: true,
              children: []
            });
          }
          const catNode = categoryMap.get(category)!;
          catNode.children!.push(node);
        } else {
          topLevelNodes.push(node);
        }
      }
    });

    // Assemble under master root
    const rootChildren: TagHierarchyNode[] = [
      ...Array.from(categoryMap.values()),
      ...topLevelNodes
    ];

    // Compute cumulative counts
    const calculateTotalCount = (node: TagHierarchyNode): number => {
      let sum = node.count;
      if (node.children && node.children.length > 0) {
        sum += node.children.reduce((acc, c) => acc + calculateTotalCount(c), 0);
      }
      node.totalCount = sum;
      return sum;
    };

    const root: TagHierarchyNode = {
      id: 'root:all_tags',
      name: 'All Catalog Tags',
      count: pages.length,
      totalCount: pages.length,
      children: rootChildren
    };

    calculateTotalCount(root);

    return root;
  }, [uniqueTagsList, parentMappings, tagCounts, pages.length]);

  // Apply collapsed nodes filtering
  const hierarchyDataWithCollapse = useMemo<TagHierarchyNode>(() => {
    const cloneNode = (node: TagHierarchyNode): TagHierarchyNode => {
      const isCollapsed = collapsedNodeIds.has(node.id);
      const cloned: TagHierarchyNode = {
        ...node,
        children: node.children ? node.children.map(cloneNode) : undefined
      };

      if (isCollapsed && cloned.children && cloned.children.length > 0) {
        cloned._children = cloned.children;
        cloned.children = undefined;
      }

      return cloned;
    };

    return cloneNode(rawHierarchyData);
  }, [rawHierarchyData, collapsedNodeIds]);

  // Handle Collapsing/Expanding individual nodes
  const handleToggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedNodeIds(new Set());
    if (onNotify) onNotify('Expanded all tag hierarchy branches', 'info');
  };

  const handleCollapseAll = () => {
    const idsToCollapse = new Set<string>();
    const traverse = (node: TagHierarchyNode) => {
      if (node.children && node.children.length > 0 && node.id !== 'root:all_tags') {
        idsToCollapse.add(node.id);
        node.children.forEach(traverse);
      }
    };
    if (rawHierarchyData.children) {
      rawHierarchyData.children.forEach(traverse);
    }
    setCollapsedNodeIds(idsToCollapse);
    if (onNotify) onNotify('Collapsed all branches to root categories', 'info');
  };

  // Reset to default hierarchy
  const handleResetDefaults = () => {
    updateParentMappings(DEFAULT_PARENT_MAPPINGS);
    setCollapsedNodeIds(new Set());
    if (onNotify) onNotify('Reset tag hierarchy to default relationships', 'success');
  };

  // Handle Reparenting a Tag
  const handleApplyReparent = () => {
    if (!reparentTargetTag) return;
    const nextMappings = { ...parentMappings };
    if (reparentNewParent === '__none__') {
      delete nextMappings[reparentTargetTag];
      if (onNotify) onNotify(`Removed parent for #${reparentTargetTag}`, 'info');
    } else {
      nextMappings[reparentTargetTag] = reparentNewParent;
      if (onNotify) onNotify(`Set #${reparentNewParent} as parent for #${reparentTargetTag}`, 'success');
    }
    updateParentMappings(nextMappings);
    setIsReparentModalOpen(false);
  };

  // D3 Tree Rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = isExpandedView ? 700 : 540;

    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on('zoom', (event) => {
        if (gRef.current) {
          d3.select(gRef.current).attr('transform', event.transform);
        }
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    const g = d3.select(gRef.current);
    g.selectAll('*').remove();

    // Hierarchy Root
    const root = d3.hierarchy<TagHierarchyNode>(hierarchyDataWithCollapse);

    // Dynamic node size based on orientation
    const isHoriz = orientation === 'horizontal';
    const treeLayout = d3.tree<TagHierarchyNode>()
      .nodeSize(isHoriz ? [54, 210] : [190, 85])
      .separation((a, b) => (a.parent === b.parent ? 1.15 : 1.35));

    treeLayout(root);

    // Bounds calculation to auto-center
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    root.each(d => {
      const x = isHoriz ? (d as any).y : (d as any).x;
      const y = isHoriz ? (d as any).x : (d as any).y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    // Center the graph initially
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const initialScale = Math.min(1, Math.max(0.65, 0.85 * Math.min(width / (graphWidth + 240), height / (graphHeight + 140))));

    let initialTranslateX = 0;
    let initialTranslateY = 0;

    if (isHoriz) {
      initialTranslateX = 50 - minX * initialScale;
      initialTranslateY = height / 2 - ((minY + maxY) / 2) * initialScale;
    } else {
      initialTranslateX = width / 2 - ((minX + maxX) / 2) * initialScale;
      initialTranslateY = 50 - minY * initialScale;
    }

    const initialTransform = d3.zoomIdentity
      .translate(initialTranslateX, initialTranslateY)
      .scale(initialScale);

    svg.call(zoom.transform, initialTransform);

    // 1. Draw Links with smooth cubic bezier curves
    const linkGenerator = (d: any) => {
      const sourceX = isHoriz ? d.source.y : d.source.x;
      const sourceY = isHoriz ? d.source.x : d.source.y;
      const targetX = isHoriz ? d.target.y : d.target.x;
      const targetY = isHoriz ? d.target.x : d.target.y;

      const nodeW = 160;
      const nodeH = 38;

      if (isHoriz) {
        // Link from right edge of source card to left edge of target card
        const sx = sourceX + nodeW;
        const sy = sourceY + nodeH / 2;
        const tx = targetX;
        const ty = targetY + nodeH / 2;
        const mx = (sx + tx) / 2;
        return `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
      } else {
        // Link from bottom edge of source card to top edge of target card
        const sx = sourceX + nodeW / 2;
        const sy = sourceY + nodeH;
        const tx = targetX + nodeW / 2;
        const ty = targetY;
        const my = (sy + ty) / 2;
        return `M ${sx},${sy} C ${sx},${my} ${tx},${my} ${tx},${ty}`;
      }
    };

    g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('d', linkGenerator)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const targetData = d.target.data;
        if (searchQuery && targetData.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return isLight ? '#3b82f6' : '#d4d4d8';
        }
        return isLight ? '#cbd5e1' : '#3f3f46';
      })
      .attr('stroke-width', (d) => {
        const targetData = d.target.data;
        if (searchQuery && targetData.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return 2.5;
        }
        return 1.5;
      })
      .attr('stroke-dasharray', (d) => (d.target.data.isCustomCategory ? '4,4' : 'none'))
      .attr('opacity', 0.85);

    // 2. Draw Nodes
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => {
        const x = isHoriz ? d.y : d.x;
        const y = isHoriz ? d.x : d.y;
        return `translate(${x},${y})`;
      })
      .style('cursor', 'pointer');

    const cardWidth = 160;
    const cardHeight = 38;

    // Node Card Rectangle
    nodeGroup.append('rect')
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', (d) => {
        const data = d.data;
        const isSelected = selectedTag && data.tag && selectedTag.toLowerCase() === data.tag.toLowerCase();
        if (isLight) {
          if (isSelected) return '#eff6ff'; // blue-50
          if (d.depth === 0) return '#0f172a'; // slate-900 for master root
          if (data.isCustomCategory) return '#f8fafc'; // slate-50 for category
          return '#ffffff';
        } else {
          if (isSelected) return '#27272a'; // zinc-800
          if (d.depth === 0) return '#09090b'; // zinc-950 for master root
          if (data.isCustomCategory) return '#18181b'; // zinc-900 for category
          return '#18181b';
        }
      })
      .attr('stroke', (d) => {
        const data = d.data;
        const isSelected = selectedTag && data.tag && selectedTag.toLowerCase() === data.tag.toLowerCase();
        if (isLight) {
          if (isSelected) return '#3b82f6'; // blue-500
          if (searchQuery && data.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return '#2563eb';
          }
          if (d.depth === 0) return '#1e293b';
          if (data.isCustomCategory) return '#e2e8f0';
          return '#cbd5e1';
        } else {
          if (isSelected) return '#a1a1aa'; // zinc-400
          if (searchQuery && data.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return '#d4d4d8';
          }
          if (d.depth === 0) return '#52525b';
          if (data.isCustomCategory) return '#27272a';
          return '#3f3f46';
        }
      })
      .attr('stroke-width', (d) => {
        const data = d.data;
        const isSelected = selectedTag && data.tag && selectedTag.toLowerCase() === data.tag.toLowerCase();
        if (isSelected) return 2.5;
        if (searchQuery && data.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return 2;
        }
        return 1;
      })
      .style('filter', isLight ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35))');

    // Left accent bar
    nodeGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 4)
      .attr('height', cardHeight)
      .attr('rx', 2)
      .attr('fill', (d) => {
        const data = d.data;
        const isSelected = selectedTag && data.tag && selectedTag.toLowerCase() === data.tag.toLowerCase();
        if (!isLight) {
          if (isSelected) return '#f4f4f5';
          if (d.depth === 0) return '#d4d4d8';
          if (data.isCustomCategory) return '#71717a';
          if (d.depth === 1) return '#a1a1aa';
          if (d.depth === 2) return '#71717a';
          return '#10b981';
        }
        if (isSelected) return '#2563eb';
        if (d.depth === 0) return '#38bdf8';
        if (data.isCustomCategory) return '#64748b';
        if (d.depth === 1) return '#3b82f6';
        if (d.depth === 2) return '#8b5cf6';
        return '#10b981';
      });

    // Tag Icon / Hash prefix
    nodeGroup.append('text')
      .attr('x', 14)
      .attr('y', cardHeight / 2 + 4)
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .attr('fill', (d) => {
        if (!isLight) {
          if (d.depth === 0) return '#f4f4f5';
          if (d.data.isCustomCategory) return '#a1a1aa';
          return '#d4d4d8';
        }
        if (d.depth === 0) return '#38bdf8';
        if (d.data.isCustomCategory) return '#64748b';
        return '#2563eb';
      })
      .text((d) => (d.depth === 0 ? '❖' : d.data.isCustomCategory ? '📁' : '#'));

    // Tag Name Label
    nodeGroup.append('text')
      .attr('x', 28)
      .attr('y', cardHeight / 2 + 4)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('fill', (d) => {
        if (d.depth === 0) return '#ffffff';
        if (!isLight) {
          if (d.data.isCustomCategory) return '#d4d4d8';
          const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
          return isSelected ? '#ffffff' : '#e4e4e7';
        }
        if (d.data.isCustomCategory) return '#334155';
        const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
        return isSelected ? '#1d4ed8' : '#1e293b';
      })
      .text((d) => {
        const name = d.data.name;
        return name.length > 13 ? name.slice(0, 11) + '..' : name;
      });

    // Count Badge Pill (Right side)
    const badgeWidth = 36;
    const badgeHeight = 18;
    const badgeX = cardWidth - badgeWidth - 8;
    const badgeY = (cardHeight - badgeHeight) / 2;

    nodeGroup.append('rect')
      .attr('x', badgeX)
      .attr('y', badgeY)
      .attr('width', badgeWidth)
      .attr('height', badgeHeight)
      .attr('rx', 9)
      .attr('fill', (d) => {
        if (!isLight) {
          if (d.depth === 0) return '#27272a';
          const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
          if (isSelected) return '#3f3f46';
          return '#27272a';
        }
        if (d.depth === 0) return '#1e293b';
        const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
        if (isSelected) return '#dbeafe';
        return '#f1f5f9';
      });

    nodeGroup.append('text')
      .attr('x', badgeX + badgeWidth / 2)
      .attr('y', badgeY + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '700')
      .attr('fill', (d) => {
        if (!isLight) {
          if (d.depth === 0) return '#d4d4d8';
          const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
          if (isSelected) return '#ffffff';
          return '#a1a1aa';
        }
        if (d.depth === 0) return '#94a3b8';
        const isSelected = selectedTag && d.data.tag && selectedTag.toLowerCase() === d.data.tag.toLowerCase();
        if (isSelected) return '#1d4ed8';
        return '#64748b';
      })
      .text((d) => {
        const count = d.data.count;
        return count > 0 ? `${count}p` : `${d.data.totalCount}`;
      });

    // Expand/Collapse circular toggle button on nodes with children
    const collapseNodes = nodeGroup.filter((d: any) => Boolean(d.data.children || d.data._children));

    const toggleGroup = collapseNodes.append('g')
      .attr('class', 'collapse-toggle')
      .attr('transform', () => {
        if (isHoriz) {
          return `translate(${cardWidth + 8}, ${cardHeight / 2})`;
        } else {
          return `translate(${cardWidth / 2}, ${cardHeight + 8})`;
        }
      })
      .on('click', (event, d: any) => {
        handleToggleCollapse(d.data.id, event);
      });

    toggleGroup.append('circle')
      .attr('r', 8)
      .attr('fill', isLight ? '#ffffff' : '#27272a')
      .attr('stroke', isLight ? '#94a3b8' : '#71717a')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))');

    toggleGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5px')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', isLight ? '#475569' : '#e4e4e7')
      .text((d: any) => (d.data._children ? '+' : '−'));

    // Node Click Handlers
    nodeGroup.on('click', (_, d) => {
      setInspectedNode(d.data);
      if (d.data.tag) {
        if (selectedTag && selectedTag.toLowerCase() === d.data.tag.toLowerCase()) {
          onSelectTag(null);
          if (onNotify) onNotify('Cleared tag filter', 'info');
        } else {
          onSelectTag(d.data.tag);
          if (onNotify) onNotify(`Filtered catalog by #${d.data.tag}`, 'success');
        }
      }
    });

  }, [
    hierarchyDataWithCollapse,
    orientation,
    selectedTag,
    searchQuery,
    isExpandedView,
    isLight
  ]);

  // Zoom controls helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.25);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth || 900;
      const height = isExpandedView ? 700 : 540;
      d3.select(svgRef.current).transition().duration(300).call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(width / 4, height / 3).scale(0.85)
      );
    }
  };

  // Export Diagram as SVG
  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgString = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `tag_hierarchy_${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
    if (onNotify) onNotify('Exported Tag Hierarchy as SVG', 'success');
  };

  // Export Hierarchy as JSON
  const handleExportJSON = () => {
    const jsonString = JSON.stringify(rawHierarchyData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tag_hierarchy_taxonomy_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onNotify) onNotify('Exported Tag Hierarchy taxonomy JSON', 'success');
  };

  // Pages matching inspected node
  const inspectedPages = useMemo(() => {
    if (!inspectedNode || !inspectedNode.tag) return [];
    const t = inspectedNode.tag.toLowerCase();
    return pages.filter(p => p.tags && p.tags.some(tag => tag.toLowerCase() === t));
  }, [inspectedNode, pages]);

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden transition-all ${className}`}>
      {/* Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shadow-xs">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 font-sans leading-none flex items-center gap-2">
                Tag Hierarchy Visualization
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 font-mono text-[10px] font-bold">
                D3 Tree Layout
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Interactive parent-child taxonomy tree. Click any tag node to filter catalog pages or inspect branches.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tag search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tag in tree..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-sans outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-700 shadow-xs w-44"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Orientation Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setOrientation('horizontal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                orientation === 'horizontal' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Horizontal Tree (Left to Right)"
            >
              Horizontal
            </button>
            <button
              type="button"
              onClick={() => setOrientation('vertical')}
              className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                orientation === 'vertical' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vertical Tree (Top to Bottom)"
            >
              Vertical
            </button>
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={handleExpandAll}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Expand all branches"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Collapse all branches"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Reset Zoom / Fit"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Manage Relationships / Reparent Button */}
          <button
            type="button"
            onClick={() => {
              if (uniqueTagsList.length > 0) {
                setReparentTargetTag(uniqueTagsList[0]);
                setReparentNewParent(parentMappings[uniqueTagsList[0]] || '__none__');
              }
              setIsReparentModalOpen(true);
            }}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Configure or customize parent-child tag hierarchy relationships"
          >
            <GitFork className="w-3.5 h-3.5 text-blue-600" />
            <span>Set Parent</span>
          </button>

          {/* Export Menu */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportSVG}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-sans transition-all shadow-xs cursor-pointer"
              title="Export diagram as SVG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Optional Expand View Toggle */}
          {onToggleExpandView && (
            <button
              type="button"
              onClick={onToggleExpandView}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-sans transition-all shadow-xs cursor-pointer"
              title={isExpandedView ? 'Compress view' : 'Maximize tree view'}
            >
              {isExpandedView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={containerRef}
        className="relative bg-slate-50/70 border-b border-slate-100 overflow-hidden select-none"
        style={{ height: isExpandedView ? '700px' : '540px' }}
      >
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <defs>
            {/* Background Grid Pattern */}
            <pattern id="tree-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke={isLight ? '#e2e8f0' : '#27272a'} strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tree-grid)" />
          <g ref={gRef} />
        </svg>

        {/* Active Filter Pill Overlay if tag is selected */}
        {selectedTag && (
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl px-3.5 py-2 shadow-sm flex items-center gap-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-sans font-medium text-slate-600">Active Catalog Tag Filter:</span>
            <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold">
              #{selectedTag}
            </span>
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              className="ml-1 p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
              title="Clear tag filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Legend / Quick Tips */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-xs text-[11px] text-slate-500 font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
            <span>Root</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Category / Parent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Leaf Tag</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">Scroll to zoom • Drag to pan • Click node to filter</span>
        </div>
      </div>

      {/* Selected Node Details Drawer / Popover */}
      {inspectedNode && (
        <div className="p-4 sm:p-5 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-slate-100 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 font-sans">
                  {inspectedNode.isCustomCategory ? inspectedNode.name : `#${inspectedNode.name}`}
                </span>
                {inspectedNode.tag && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                    {inspectedPages.length} direct page(s)
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                  {inspectedNode.totalCount} total in branch
                </span>
                {inspectedNode.children && inspectedNode.children.length > 0 && (
                  <span className="text-xs text-slate-400 font-sans">
                    ({inspectedNode.children.length} sub-branches)
                  </span>
                )}
              </div>

              {/* Sample pages tagged with this node */}
              {inspectedPages.length > 0 ? (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-medium">Pages:</span>
                  {inspectedPages.slice(0, 3).map(p => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-sans truncate max-w-[200px]"
                      title={p.title}
                    >
                      {p.title}
                    </span>
                  ))}
                  {inspectedPages.length > 3 && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      +{inspectedPages.length - 3} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  Branch category grouping related sub-tags and taxonomy nodes.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {inspectedNode.tag && (
              <button
                type="button"
                onClick={() => {
                  const isCurrent = selectedTag && selectedTag.toLowerCase() === inspectedNode.tag!.toLowerCase();
                  if (isCurrent) {
                    onSelectTag(null);
                    if (onNotify) onNotify('Cleared tag filter', 'info');
                  } else {
                    onSelectTag(inspectedNode.tag!);
                    if (onNotify) onNotify(`Filtered catalog by #${inspectedNode.tag}`, 'success');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                  selectedTag && selectedTag.toLowerCase() === inspectedNode.tag.toLowerCase()
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {selectedTag && selectedTag.toLowerCase() === inspectedNode.tag.toLowerCase()
                    ? 'Clear Filter'
                    : `Filter Catalog by #${inspectedNode.tag}`}
                </span>
              </button>
            )}

            {inspectedNode.tag && (
              <button
                type="button"
                onClick={() => {
                  setReparentTargetTag(inspectedNode.tag!);
                  setReparentNewParent(parentMappings[inspectedNode.tag!] || '__none__');
                  setIsReparentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <GitFork className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Parent</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setInspectedNode(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Set Parent / Reparenting Modal */}
      {isReparentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                  <GitFork className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-slate-900 font-sans">
                  Configure Tag Parent Relationship
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsReparentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs font-sans">
              {/* Select Target Child Tag */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Select Tag (Child):</label>
                <select
                  value={reparentTargetTag}
                  onChange={(e) => {
                    const t = e.target.value;
                    setReparentTargetTag(t);
                    setReparentNewParent(parentMappings[t] || '__none__');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-medium outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                >
                  {uniqueTagsList.map(tag => (
                    <option key={tag} value={tag}>
                      #{tag} ({tagCounts[tag] || 0} pages)
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Parent Tag */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Assign Under Parent Tag / Category:</label>
                <select
                  value={reparentNewParent}
                  onChange={(e) => setReparentNewParent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-medium outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                >
                  <option value="__none__">-- None (Make Top-Level Tag) --</option>
                  <optgroup label="Available Parent Tags">
                    {uniqueTagsList
                      .filter(tag => tag !== reparentTargetTag)
                      .map(tag => (
                        <option key={tag} value={tag}>
                          #{tag} ({tagCounts[tag] || 0} pages)
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-400">
                  Select a parent tag to nest #{reparentTargetTag} as its child in the D3 hierarchy tree.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download JSON Taxonomy</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReparentModalOpen(false)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-800 font-sans font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyReparent}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
              >
                Save Relationship
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagHierarchyTree;
