const { Question, Enrollment } = require('../models/index');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getCourseQuestions = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sort = '-createdAt', resolved } = req.query;
  const filter = { course: req.params.courseId };
  if (resolved !== undefined) filter.isResolved = resolved === 'true';

  const [questions, total] = await Promise.all([
    Question.find(filter)
      .populate('student', 'name avatar role')
      .populate('answers.author', 'name avatar role')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(+limit),
    Question.countDocuments(filter),
  ]);

  res.json({ success: true, data: questions, meta: { page: +page, limit: +limit, total } });
});

exports.postQuestion = catchAsync(async (req, res) => {
  const enrolled = await Enrollment.exists({ student: req.user._id, course: req.params.courseId });
  if (!enrolled && req.user.role !== 'admin') {
    throw new AppError('You must be enrolled in this course to post questions', 403);
  }

  const question = await Question.create({
    course: req.params.courseId,
    lecture: req.body.lectureId,
    student: req.user._id,
    title: req.body.title,
    body: req.body.body,
  });

  await question.populate('student', 'name avatar role');

  // Real-time emit to course room
  const io = req.app.get('io');
  if (io) io.to(`course:${req.params.courseId}`).emit('new:question', question);

  res.status(201).json({ success: true, data: question });
});

exports.updateQuestion = catchAsync(async (req, res) => {
  const question = await Question.findOneAndUpdate(
    { _id: req.params.questionId, student: req.user._id },
    { title: req.body.title, body: req.body.body },
    { new: true, runValidators: true }
  );
  if (!question) throw new AppError('Question not found or you are not the author', 404);
  res.json({ success: true, data: question });
});

exports.deleteQuestion = catchAsync(async (req, res) => {
  const filter = req.user.role === 'admin'
    ? { _id: req.params.questionId }
    : { _id: req.params.questionId, student: req.user._id };
  const question = await Question.findOneAndDelete(filter);
  if (!question) throw new AppError('Question not found', 404);
  res.json({ success: true, message: 'Question deleted' });
});

exports.postAnswer = catchAsync(async (req, res) => {
  const question = await Question.findByIdAndUpdate(
    req.params.questionId,
    { $push: { answers: { author: req.user._id, body: req.body.body, createdAt: new Date() } } },
    { new: true }
  ).populate('answers.author', 'name avatar role');

  if (!question) throw new AppError('Question not found', 404);

  const io = req.app.get('io');
  if (io) io.to(`course:${question.course}`).emit('new:answer', { questionId: question._id, answer: question.answers.at(-1) });

  res.status(201).json({ success: true, data: question });
});

exports.updateAnswer = catchAsync(async (req, res) => {
  const question = await Question.findOneAndUpdate(
    { _id: req.params.questionId, 'answers._id': req.params.answerId, 'answers.author': req.user._id },
    { $set: { 'answers.$.body': req.body.body, 'answers.$.updatedAt': new Date() } },
    { new: true }
  );
  if (!question) throw new AppError('Answer not found or you are not the author', 404);
  res.json({ success: true, data: question });
});

exports.deleteAnswer = catchAsync(async (req, res) => {
  const question = await Question.findByIdAndUpdate(
    req.params.questionId,
    { $pull: { answers: { _id: req.params.answerId, author: req.user._id } } },
    { new: true }
  );
  if (!question) throw new AppError('Answer not found', 404);
  res.json({ success: true, data: question });
});

exports.upvoteAnswer = catchAsync(async (req, res) => {
  const question = await Question.findById(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);

  const answer = question.answers.id(req.params.answerId);
  if (!answer) throw new AppError('Answer not found', 404);

  const idx = answer.upvotes.findIndex(id => id.equals(req.user._id));
  if (idx > -1) answer.upvotes.splice(idx, 1);
  else answer.upvotes.push(req.user._id);

  await question.save();
  res.json({ success: true, data: { upvotes: answer.upvotes.length, upvoted: idx === -1 } });
});

exports.markAnswerCorrect = catchAsync(async (req, res) => {
  const question = await Question.findById(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);

  question.answers.forEach(a => {
    a.isMarkedCorrect = a._id.toString() === req.params.answerId;
  });
  question.isResolved = true;
  await question.save();

  res.json({ success: true, message: 'Answer marked as correct', data: question });
});
