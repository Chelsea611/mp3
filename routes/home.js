

var User = require('../models/user');
var mongoose = require('mongoose');
 
var TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    deadline: {
        type: Date,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    assignedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedUserName: {
        type: String,
        default: 'unassigned'
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});
var Task = mongoose.model('Task', TaskSchema);

module.exports = function (router) {
    var homeRoute = router.route('/');
    
    // Home route
    homeRoute.get(function (req, res) {
        res.json({ 
            message: 'Todo API Server is running',
            data: null
        });
    });

    // ========== USER ROUTES ==========
    
    // GET /api/users
    router.route('/users').get(function (req, res) {
        var where = req.query.where ? JSON.parse(req.query.where) : {};
        var sort = req.query.sort ? JSON.parse(req.query.sort) : {};
        var select = req.query.select ? JSON.parse(req.query.select) : {};
        var skip = parseInt(req.query.skip) || 0;
        var limit = parseInt(req.query.limit) || 0;
        var count = req.query.count === 'true';

        var query = User.find(where);

        if (Object.keys(sort).length > 0) query = query.sort(sort);
        if (Object.keys(select).length > 0) query = query.select(select);
        if (skip > 0) query = query.skip(skip);
        if (limit > 0) query = query.limit(limit);

        if (count) {
            User.countDocuments(where).then(function(count) {
                res.json({ message: "OK", data: { count: count } });
            }).catch(function(error) {
                res.status(500).json({ message: "Server error", data: null });
            });
        } else {
            query.then(function(users) {
                res.json({ message: "OK", data: users });
            }).catch(function(error) {
                res.status(500).json({ message: "Server error", data: null });
            });
        }
    });

    // POST /api/users
    router.route('/users').post(function (req, res) {
        var user = new User();
        user.name = req.body.name;
        user.email = req.body.email;
        user.pendingTasks = req.body.pendingTasks || [];

        if (!user.name || !user.email) {
            return res.status(400).json({ message: "Name and email are required", data: null });
        }

        User.findOne({ email: user.email }).then(function(existingUser) {
            if (existingUser) {
                return res.status(400).json({ message: "Email already exists", data: null });
            }
            return user.save();
        }).then(function(newUser) {
            res.status(201).json({ message: "User created successfully", data: newUser });
        }).catch(function(error) {
            if (error.code === 11000) {
                res.status(400).json({ message: "Email already exists", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // GET /api/users/:id
    router.route('/users/:id').get(function (req, res) {
        var select = req.query.select ? JSON.parse(req.query.select) : {};
        var query = User.findById(req.params.id);
        if (Object.keys(select).length > 0) query = query.select(select);

        query.then(function(user) {
            if (!user) return res.status(404).json({ message: "User not found", data: null });
            res.json({ message: "OK", data: user });
        }).catch(function(error) {
            if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid user ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // PUT /api/users/:id
    router.route('/users/:id').put(function (req, res) {
        User.findById(req.params.id).then(function(user) {
            if (!user) return res.status(404).json({ message: "User not found", data: null });
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({ message: "Name and email are required", data: null });
            }

            if (req.body.email !== user.email) {
                return User.findOne({ email: req.body.email }).then(function(existingUser) {
                    if (existingUser) throw new Error("Email already exists");
                    user.name = req.body.name;
                    user.email = req.body.email;
                    user.pendingTasks = req.body.pendingTasks || [];
                    return user.save();
                });
            } else {
                user.name = req.body.name;
                user.pendingTasks = req.body.pendingTasks || [];
                return user.save();
            }
        }).then(function(updatedUser) {
            res.json({ message: "User updated successfully", data: updatedUser });
        }).catch(function(error) {
            if (error.message === "Email already exists") {
                res.status(400).json({ message: error.message, data: null });
            } else if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid user ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // DELETE /api/users/:id
    router.route('/users/:id').delete(function (req, res) {
        User.findByIdAndDelete(req.params.id).then(function(user) {
            if (!user) return res.status(404).json({ message: "User not found", data: null });
            
            // Unassign user's tasks
            Task.updateMany(
                { assignedUser: req.params.id },
                { assignedUser: null, assignedUserName: 'unassigned' }
            ).then(function() {
                res.status(204).json({ message: "User deleted successfully", data: null });
            });
        }).catch(function(error) {
            if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid user ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // ========== TASK ROUTES ==========
    
    // GET /api/tasks
    router.route('/tasks').get(function (req, res) {
        var where = req.query.where ? JSON.parse(req.query.where) : {};
        var sort = req.query.sort ? JSON.parse(req.query.sort) : {};
        var select = req.query.select ? JSON.parse(req.query.select) : {};
        var skip = parseInt(req.query.skip) || 0;
        var limit = parseInt(req.query.limit) || 100;
        var count = req.query.count === 'true';

        var query = Task.find(where);

        if (Object.keys(sort).length > 0) query = query.sort(sort);
        if (Object.keys(select).length > 0) query = query.select(select);
        if (skip > 0) query = query.skip(skip);
        if (limit > 0) query = query.limit(limit);

        if (count) {
            Task.countDocuments(where).then(function(count) {
                res.json({ message: "OK", data: { count: count } });
            }).catch(function(error) {
                res.status(500).json({ message: "Server error", data: null });
            });
        } else {
            query.then(function(tasks) {
                res.json({ message: "OK", data: tasks });
            }).catch(function(error) {
                res.status(500).json({ message: "Server error", data: null });
            });
        }
    });

    // POST /api/tasks
    router.route('/tasks').post(function (req, res) {
        var task = new Task();
        task.name = req.body.name;
        task.description = req.body.description || '';
        task.deadline = req.body.deadline;
        task.completed = req.body.completed || false;
        task.assignedUser = req.body.assignedUser || null;

        if (!task.name || !task.deadline) {
            return res.status(400).json({ message: "Name and deadline are required", data: null });
        }

        var userPromise = Promise.resolve();
        if (task.assignedUser) {
            userPromise = User.findById(task.assignedUser).then(function(user) {
                if (!user) throw new Error("Assigned user not found");
                task.assignedUserName = user.name;
                user.pendingTasks.push(task._id);
                return user.save();
            });
        } else {
            task.assignedUserName = 'unassigned';
        }

        userPromise.then(function() {
            return task.save();
        }).then(function(newTask) {
            res.status(201).json({ message: "Task created successfully", data: newTask });
        }).catch(function(error) {
            if (error.message === "Assigned user not found") {
                res.status(400).json({ message: error.message, data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // GET /api/tasks/:id
    router.route('/tasks/:id').get(function (req, res) {
        var select = req.query.select ? JSON.parse(req.query.select) : {};
        var query = Task.findById(req.params.id);
        if (Object.keys(select).length > 0) query = query.select(select);

        query.then(function(task) {
            if (!task) return res.status(404).json({ message: "Task not found", data: null });
            res.json({ message: "OK", data: task });
        }).catch(function(error) {
            if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid task ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // PUT /api/tasks/:id
    router.route('/tasks/:id').put(function (req, res) {
        Task.findById(req.params.id).then(function(task) {
            if (!task) return res.status(404).json({ message: "Task not found", data: null });
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({ message: "Name and deadline are required", data: null });
            }

            var oldAssignedUser = task.assignedUser;
            var newAssignedUser = req.body.assignedUser || null;

            task.name = req.body.name;
            task.description = req.body.description || '';
            task.deadline = req.body.deadline;
            task.completed = req.body.completed || false;
            task.assignedUser = newAssignedUser;

            var userPromises = [];

            if (oldAssignedUser && oldAssignedUser.toString() !== newAssignedUser) {
                userPromises.push(
                    User.findByIdAndUpdate(oldAssignedUser, {
                        $pull: { pendingTasks: task._id }
                    })
                );
            }

            if (newAssignedUser) {
                userPromises.push(
                    User.findById(newAssignedUser).then(function(user) {
                        if (!user) throw new Error("Assigned user not found");
                        task.assignedUserName = user.name;
                        if (!user.pendingTasks.includes(task._id)) {
                            user.pendingTasks.push(task._id);
                            return user.save();
                        }
                    })
                );
            } else {
                task.assignedUserName = 'unassigned';
            }

            return Promise.all(userPromises).then(function() {
                return task.save();
            });
        }).then(function(updatedTask) {
            res.json({ message: "Task updated successfully", data: updatedTask });
        }).catch(function(error) {
            if (error.message === "Assigned user not found") {
                res.status(400).json({ message: error.message, data: null });
            } else if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid task ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    // DELETE /api/tasks/:id
    router.route('/tasks/:id').delete(function (req, res) {
        Task.findById(req.params.id).then(function(task) {
            if (!task) return res.status(404).json({ message: "Task not found", data: null });

            if (task.assignedUser) {
                return User.findByIdAndUpdate(task.assignedUser, {
                    $pull: { pendingTasks: task._id }
                }).then(function() {
                    return Task.findByIdAndDelete(req.params.id);
                });
            } else {
                return Task.findByIdAndDelete(req.params.id);
            }
        }).then(function() {
            res.status(204).json({ message: "Task deleted successfully", data: null });
        }).catch(function(error) {
            if (error.name === 'CastError') {
                res.status(400).json({ message: "Invalid task ID", data: null });
            } else {
                res.status(500).json({ message: "Server error", data: null });
            }
        });
    });

    return router;
};