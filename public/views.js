var PileView = Backbone.View.extend({
	html: '<div class="well selection" />' +
	      // '<h3>Any of these could be your next action:</h3>' +
	      // '<div class="nexts"></ul>' +
	      '<h3 class="tasks">Here are your tasks in approximate order:</h3>' +
	      '<div class="rest task-list"></div>' +
	      '<h3 class="add">Add tasks:</h3>' +
	      '<div class="new-task"></div>',

	initialize: function () {
		this.pile = this.model;

		this.$el.html(this.html);
		this.$selection = this.$(".selection");
		this.$newTask = this.$(".new-task");
		// this.$nexts = this.$(".nexts");
		this.$rest = this.$(".rest");
		this.$tasksHeader = this.$("h3.tasks");
		this.$addHeader = this.$("h3.add");

		this.selectionView = new SelectionView({ el: this.$selection[0] });
		this.selectionView.render();
		this.listenTo(this.selectionView, "compared", this.tasksCompared);
		this.listenTo(this.selectionView, "shuffle", this.render);

		this.taskListView = new TaskListView({ el: this.$rest, model: this.pile });
		this.taskListView.render();

		this.newTasksView = new NewTasksView({ el: this.$newTask });
		this.newTasksView.on("add-many", this.addNewTasks, this);
		this.newTasksView.render();

		this.listenTo(this.pile.tasks, "add remove reset", this.render);
		this.listenTo(this.pile.comparisons, "add remove reset change", this.render);

		this.pile.tasks.fetch();
		this.pile.comparisons.fetch();
	},

	render: function () {
		if (this.pile.taskForest.potentialNextTasks.length > 1) {
			var pair = _.sortBy(this.pile.taskForest.potentialNextTasks, Math.random).slice(0, 2);
			var progress = 1 - ((this.pile.taskForest.potentialNextTasks.length - 1) / this.pile.tasks.length);
			this.selectionView.prepare(pair[0], pair[1], progress);
			this.selectionView.render();
			this.$selection.show();

			this.taskListView.highlightNextAction = false;
		} else {
			this.$selection.hide();

			this.taskListView.highlightNextAction = true;
		}

		this.taskListView.render();

		this.$tasksHeader.toggle(this.pile.tasks.length > 0);
		this.$addHeader.text(this.pile.tasks.length > 0 ? "Add more tasks:" : "Add tasks:");

		return this;
	},

	addNewTasks: function (texts) {
		_.each(texts, function (text) {
			this.pile.tasks.create({ text: text });
		}, this);
	},

	tasksCompared: function (greaterTask, lesserTask) {
		this.pile.comparisons.create({
			greaterTaskId: greaterTask.id,
			lesserTaskId: lesserTask.id,
		});
	},
});

var SelectionView = Backbone.View.extend({
	html: '<div class="question text-center">Which is it more important to do first?</div>' +
	      '<div class="row text-center button-row">' +
	      '  <div class="left col-md-5"><button type="button" class="btn btn-success">This One!</button></div>' +
	      '  <div class="col-md-2"><button type="button" class="btn btn-xs btn-default shuffle">I can\'t decide!</button></div>' +
	      '  <div class="right col-md-5"><button type="button" class="btn btn-success">This One!</button></div>' +
	      '</div>' +
	      '<div class="row task-row">' +
	      '  <div class="left col-md-6"></div>' +
	      '  <div class="right col-md-6"></div>' +
	      '</div>' +
	      '<div class="progress">' +
	      '  <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">' +
	      '    <span class="sr-only">0% Complete</span>' +
	      '  </div>' +
	      '</div>',

	className: "selection",

	events: {
		"click .shuffle" : "shuffleClicked",
		"click .button-row .left button" : "leftClicked",
		"click .button-row .right button" : "rightClicked",
	},

	initialize: function () {
		this.$el.html(this.html);
		this.$left = this.$(".task-row .left");
		this.$right = this.$(".task-row .right");
	},

	render: function () {
		this.renderOne(this.$left, this.leftTask);
		this.renderOne(this.$right, this.rightTask);
	},

	renderOne: function ($el, task) {
		$el.empty();

		if (task) {
			var view = new TaskView({ model: task, className: "task selection-task" });
			$el.append(view.el);

			// var $restHeader = $('<strong>which you said you\'d do before:</strong>');
			// var $rest = $('<div class="rest" />');
			// for (var i = 0; i < 4; i++) {
			// 	var $item = $('<div class="task" />', {
			// 		text: "Task " + i,
			// 	});
			// 	$rest.append($item);
			// }
			// $el.append($task, $restHeader, $rest);
		}
	},

	prepare: function (leftTask, rightTask, progress) {
		this.leftTask = leftTask;
		this.rightTask = rightTask;
		this.setProgress(progress);
	},

	setProgress: function (percent) {
		var outOf100 = percent * 100;
		this.$(".progress-bar")
			.prop("aria-valuenow", Math.floor(outOf100))
			.css("width", outOf100 + "%");
		this.$(".progress-bar span").text(outOf100 + "% Complete");
	},

	shuffleClicked: function () {
		this.trigger("shuffle");
	},

	leftClicked: function (e) {
		this.clicked(e, this.leftTask, this.rightTask);
	},

	rightClicked: function (e) {
		this.clicked(e, this.rightTask, this.leftTask);
	},

	clicked: function (e, greaterTask, lesserTask) {
		this.trigger("compared", greaterTask, lesserTask);
	},
});

var TaskListView = Backbone.View.extend({
	html: '',

	initialize: function () {
		this.pile = this.model;
		this.tasks = this.pile.tasks;
		this.listenTo(this.tasks, "add", this.taskAdded);
		this.listenTo(this.tasks, "remove", this.taskRemoved);
		this.listenTo(this.tasks, "reset", this.tasksReset);
		this.listenTo(this.tasks, "sort", this.tasksSorted);

		this.taskViews = [];

		this.tasksReset();
	},

	render: function () {
		this.$el.toggleClass("highlight-next-action", this.highlightNextAction);
	},

	taskAdded: function () {
		var task = arguments[0];
		var options = arguments[2];
		var view = new TaskView({ model: task });
		this.taskViews.push(view);
		this.$el.append(view.render().el);
	},

	taskRemoved: function () {
		var task = arguments[0];
		var options = arguments[2];
		var view = this.taskViews[options.index];

		if (view && view.task.cid === task.cid) {
			view.$el.detach();
			this.taskViews.splice(options.index, 1);
		} else {
			console.log("views out of sync! rendering task list view from scratch");
			this.tasksReset();
		}
	},

	tasksReset: function () {
		// TODO: reuse views, discard unneeded views

		this.$el.html(this.html);

		this.taskViews = this.tasks.map(function (task) {
			return new TaskView({ model: task });
		});

		_.each(this.taskViews, function (view) {
			this.$el.append(view.render().el);
		}, this);
	},

	tasksSorted: function () {
		var viewsByCid = _.indexBy(this.taskViews, function (view) {
			view.$el.detach();
			return view.task.cid;
		});

		this.taskViews = this.tasks.map(function (task) {
			if (viewsByCid[task.cid]) {
				return viewsByCid[task.cid];
			} else {
				console.error("making new view during sort");
				return new TaskView({ model: task });
			}
		});

		_.each(this.taskViews, function (view) {
			this.$el.append(view.render().el);
		}, this);
	},
});

var TaskView = Backbone.View.extend({
	html: '<div class="tools">' +
	      '<button type="button" class="btn btn-xs btn-default edit">Edit</button>' +
	      '<button type="button" class="btn btn-xs btn-default reprioritize">Reprioritize</button>' +
	      // '<button type="button" class="btn btn-xs btn-success done">Done!</button>' +
	      '<button type="button" class="btn btn-xs btn-danger delete">Delete</button>' +
	      '</div>' +
	      '<span class="text"></span>',

	className: "task",

	events: {
		"click button.edit" : "editClicked",
		"click button.reprioritize" : "reprioritizeClicked",
		"click button.done" : "doneClicked",
		"click button.delete" : "deleteClicked",
	},

	initialize: function () {
		this.task = this.model;

		this.$el.html(this.html);
		this.$text = this.$("span.text");

		this.listenTo(this.task, "change:text", this.textChanged);

		this.textChanged();
	},

	textChanged: function () {
		this.$text.text(this.task.get("text")).linkify();
	},

	editClicked: function () {
		var newText = prompt("", this.task.get("text"));
		if (newText !== null) {
			this.task.save({ text: newText });
		}
	},

	reprioritizeClicked: function () {
		var comparisons = [].concat(
			this.model.collection.pile.comparisons.where({ lesserTaskId: this.task.id }),
			this.model.collection.pile.comparisons.where({ greaterTaskId: this.task.id })
		);
		_.each(comparisons, function (comparison) {
			comparison.invalidate();
		});
	},

	deleteClicked: function () {
		this.task.destroy();
	},
});

var NewTasksView = Backbone.View.extend({
	html: '<form class="form-inline" role="form">' +
	      '<label class="sr-only" for="new-task-textarea">Several to-do items, one per line</label>' +
	      '<textarea class="form-control" rows="4" cols="60" id="new-task-textarea" placeholder="Several tasks, one per line"></textarea>' +
	      '<button type="submit" class="btn btn-default add-several">Add Tasks</button>' +
	      '</form>',

	className: "new-task",

	events: {
		"click button.add-several" : "addSeveralTasks",
		"input textarea#new-task-textarea" : "textChanged",
		"propertychange textarea#new-task-textarea" : "textChanged",
	},

	initialize: function () {
		this.$el.html(this.html);
		this.$addButton = this.$("button.add-several");
	},

	render: function () {
	},

	textChanged: function () {
		var texts = this._texts();
		this.$addButton.text("Add " + texts.length + " Task" + (texts.length === 1 ? "" : "s"));
	},

	addSeveralTasks: function (e) {
		e.preventDefault();
		var texts = this._texts();
		this.trigger("add-many", texts);
		this.$("#new-task-textarea").val("").focus();
	},

	_texts: function () {
		var texts = [];
		_.each(this.$("#new-task-textarea").val().split(/[\r\n]+/), function (text) {
			text = text.trim();
			if (text.length > 0) {
				texts.push(text);
			}
		}, this);
		return texts;
	},
});
