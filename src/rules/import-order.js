'use strict'

import find from 'lodash.find'
import importType from '../core/importType'
import isStaticRequire from '../core/staticRequire'

const defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index']

// REPORTING

function reverse(array) {
  return array.map(function (v) {
    return {
      name: v.name,
      rank: -v.rank,
      node: v.node,
    }
  }).reverse()
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return []
  }
  let maxSeenRankNode = imported[0]
  return imported.filter(function (importedModule) {
    const res = importedModule.rank < maxSeenRankNode.rank
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule
    }
    return res
  })
}

function report(context, imported, outOfOrder, order) {
  outOfOrder.forEach(function (imp) {
    const found = find(imported, function hasHigherRank(importedItem) {
      return importedItem.rank > imp.rank
    })
    context.report(imp.node, '`' + imp.name + '` import should occur ' + order +
      ' import of `' + found.name + '`')
  })
}

function makeReport(context, imported) {
  const outOfOrder = findOutOfOrder(imported)
  if (!outOfOrder.length) {
    return
  }
  // There are things to report. Try to minimize the number of reported errors.
  const reversedImported = reverse(imported)
  const reversedOrder = findOutOfOrder(reversedImported)
  if (reversedOrder.length < outOfOrder.length) {
    report(context, reversedImported, reversedOrder, 'after')
    return
  }
  report(context, imported, outOfOrder, 'before')
}

// DETECTING

function computeRank(context, ranks, name) {
  return ranks[importType(name, context)]
}

function registerNode(context, node, name, ranks, imported) {
  const rank = computeRank(context, ranks, name)
  if (rank !== -1) {
    imported.push({name: name, rank: rank, node: node})
  }
}

function isInVariableDeclarator(node) {
  return node &&
    (node.type === 'VariableDeclarator' || isInVariableDeclarator(node.parent))
}

const types = ['builtin', 'external', 'internal', 'parent', 'sibling', 'index']

// Creates an object with type-rank pairs.
// Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
// Will throw an error if it contains a type that does not exist, or has a duplicate
function convertGroupsToRanks(groups) {
  const rankObject = groups.reduce(function(res, group, index) {
    if (typeof group === 'string') {
      group = [group]
    }
    group.forEach(function(groupItem) {
      if (types.indexOf(groupItem) === -1) {
        throw new Error('Incorrect configuration of the rule: Unknown type `' +
          JSON.stringify(groupItem) + '`')
      }
      if (res[groupItem] !== undefined) {
        throw new Error('Incorrect configuration of the rule: `' + groupItem + '` is duplicated')
      }
      res[groupItem] = index
    })
    return res
  }, {})

  const omittedTypes = types.filter(function(type) {
    return rankObject[type] === undefined
  })

  return omittedTypes.reduce(function(res, type) {
    res[type] = groups.length
    return res
  }, rankObject)
}

module.exports = function importOrderRule (context) {
  const options = context.options[0] || {}
  let ranks

  try {
    ranks = convertGroupsToRanks(options.groups || defaultGroups)
  } catch (error) {
    // Malformed configuration
    return {
      Program: function(node) {
        context.report(node, error.message)
      },
    }
  }
  let imported = []
  let level = 0

  function incrementLevel() {
    level++
  }
  function decrementLevel() {
    level--
  }

  return {
    ImportDeclaration: function handleImports(node) {
      if (node.specifiers.length) { // Ignoring unassigned imports
        const name = node.source.value
        registerNode(context, node, name, ranks, imported)
      }
    },
    CallExpression: function handleRequires(node) {
      if (level !== 0 || !isStaticRequire(node) || !isInVariableDeclarator(node.parent)) {
        return
      }
      const name = node.arguments[0].value
      registerNode(context, node, name, ranks, imported)
    },
    'Program:exit': function reportAndReset() {
      makeReport(context, imported)
      imported = []
    },
    FunctionDeclaration: incrementLevel,
    FunctionExpression: incrementLevel,
    ArrowFunctionExpression: incrementLevel,
    BlockStatement: incrementLevel,
    'FunctionDeclaration:exit': decrementLevel,
    'FunctionExpression:exit': decrementLevel,
    'ArrowFunctionExpression:exit': decrementLevel,
    'BlockStatement:exit': decrementLevel,
  }
}

module.exports.schema = [
  {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
      },
    },
    additionalProperties: false,
  },
]
