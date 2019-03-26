const property = {
    name: 'dummy',
    quantifiedVariables: ['dummy'],
    projections: [['dummy']],
    stateMachine: {
	'DUMMY_EVENT': {
	    params: ['dummy'],
	    'INITIAL': {
		to: 'FAILURE',
	    },
	},
    },
};

module.exports = property;
