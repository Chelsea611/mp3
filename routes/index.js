/*
 * Connect all of your endpoints together here.
 */
// routes/index.js
module.exports = function (app, router) {
    app.use('/api', require('./home.js')(router));
     
    app.get('/', (req, res) => {
        res.json({ 
            message: 'Todo API Server is running',
            endpoints: {
                users: '/api/users',
                tasks: '/api/tasks'
            }
        });
    });
};