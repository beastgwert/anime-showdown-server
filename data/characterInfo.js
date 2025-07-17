const characterInfo = {
  abilityDamages: {
    'Sung-jin-woo': [160, 200],
    'Mikasa': [80, 120],
    'Luffy': [110, 130],
    'Gojo': [100, 200],
    'Natsu': [120, 130],
    'Ichigo': [0, 10],
    'Kakashi': [150, 200],
    'Anya': [125, 175],
    'Mudkip': [90, 130],
    'Genos': [200, 210],
    'Makima': [95, 135],
  },
  maxHP: {
    'Sung-jin-woo': 500,
    'Mikasa': 400,
    'Luffy': 450,
    'Gojo': 475,
    'Natsu': 425,
    'Ichigo': 375,
    'Kakashi': 450,
    'Anya': 400,
    'Mudkip': 350,
    'Genos': 550,
    'Makima': 425,
  },
  passiveAbilities: {
    'Gojo': {
      type: 'dodge',
      value: 0.20, // 15% dodge chance for all team cards
      description: 'Grants 15% dodge chance to all team cards'
    },
    'Kakashi': {
      type: 'crit',
      value: 0.25, // 25% crit chance for all team cards
      multiplier: 1.5, // 1.5x damage on crit
      description: 'Grants 25% crit chance with 1.5x damage to all team cards'
    },
    'Anya': {
      type: 'damage_reduction',
      value: 0.20, // 20% damage reduction for all team cards
      description: 'Reduces all incoming damage by 20% for all team cards'
    },
    'Makima': {
      type: 'damage_distribution',
      description: 'Distributes incoming damage equally among all alive team cards'
    },
    'Mikasa': {
      type: 'paralysis',
      value: 0.15, // 15% chance to paralyze enemy on attack
      description: 'Grants 15% chance to paralyze enemy on attack for all team cards'
    }
  },
  specialAbilities: {
    'Sung-jin-woo': {
      type: 'heal_all',
      value: 0.15, // 15% of max HP
      description: 'Heals all ally cards by 15% of their max HP'
    },
    'Genos': {
      type: 'sacrifice_blast',
      value: 0.75, // 75% of HP lost
      description: 'Deals 75% of HP lost to a random enemy, then dies'
    },
    'Mudkip': {
      type: 'accuracy_debuff',
      value: 0.50, // 50% accuracy reduction
      duration: 4, // 2 turns
      description: 'Reduces opponent accuracy by 50% for 2 turns (stacks with Gojo passive)'
    }
  }
};

module.exports = characterInfo;
