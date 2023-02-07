const express = require("express");
const app = express();
const methodOverride = require("method-override");
const path = require("path");
const Post = require("./models/post");
const ejsMate = require("ejs-mate");
const { PostSchema } = require("./schemas.js");
const multer = require("multer"); // v1.0.5
const upload = multer();
const Review = require("./models/review");
const User = require("./models/user");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const flash = require("connect-flash");
const { isLoggedIn, isAuthor } = require("./middleware");
const ExpressError = require("./utils/expressError");

const bodyParser = require("body-parser");
// const LocalStrategy = require('passport-local');

const mongoose = require("mongoose");
main().catch((err) => {
  console.log("OH NO MONGO CONNECTION ERROR");
  console.log(err);
});

// dbUrl
async function main() {
  await mongoose.connect("mongodb://localhost:27017/post");
  console.log("MONGO CONNECTION OPEN!!!");
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(flash());

const sessionConfig = {
  name: "session",
  secret: "sdsdsdsdsdsd",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // secure: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals, (currentUser = req.user);
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/posts", async (req, res) => {
  const posts = await Post.find({});
  res.render("posts/index", { posts });
});

app.get("/posts/new", isLoggedIn, (req, res, next) => {
  res.render("posts/new");
});

app.post("/posts", upload.array(), isLoggedIn, async (req, res, next) => {
  const post = new Post(req.body.post);
  post.author = req.user._id;
  await post.save();
  console.log(post);
  res.redirect(`/posts/page`);
});

app.get("/login", (req, res) => {
  res.render("users/login");
});

app.get("/posts/page", async (req, res) => {
  const posts = await Post.find({});
  res.render("posts/page", { posts });
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  upload.array(),
  async (req, res, next) => {
    req.flash("success", "welcome back!");
    const redirectUrl = req.session.returnTo || "/posts";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

app.get("/register", (req, res) => {
  res.render("users/register");
});

app.post("/register", upload.array(), async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const user = new User({ email, username });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      // req.flash('success', 'Welcome to Yelp Camp!');
      res.redirect("/posts");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("register");
  }
});

app.get("/posts/:id", upload.array(), async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");
  res.render("posts/show", { post });
});

app.get("/posts/:id/edit", isLoggedIn, isAuthor, async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.render("posts/edit", { post });
});

app.put(
  "/posts/:id",
  upload.array(),
  isLoggedIn,
  isAuthor,
  async (req, res, next) => {
    const { id } = req.params;
    const post = await Post.findByIdAndUpdate(id, { ...req.body.post });
    post.save();
    res.redirect(`/posts/${post._id}`);
  }
);

app.post(
  "/posts/:id/reviews",
  upload.array(),
  isLoggedIn,
  async (req, res, next) => {
    const post = await Post.findById(req.params.id);
    const review = new Review(req.body.review);
    review.author = req.user._id;
    post.reviews.push(review);
    await review.save();
    await post.save();
    res.redirect(`/posts/${post._id}`);
  }
);

app.delete(
  "/posts/:id/reviews/:reviewId",
  isLoggedIn,
  isAuthor,
  upload.array(),
  async (req, res, next) => {
    const { id, reviewId } = req.params;
    await Post.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/posts/${id}`);
  }
);

app.delete(
  "/posts/:id",
  upload.array(),
  isLoggedIn,
  isAuthor,
  async (req, res, next) => {
    const { id } = req.params;
    await Post.findByIdAndDelete(id);
    res.redirect("/posts/page");
  }
);

app.get("/logout", upload.array(), (req, res, next) => {
  req.logout();
  req.flash("success", "Goodbye!");
  res.redirect("/");
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong";
  res.status(statusCode).render("error", { err });
});

app.listen(3000, () => {
  console.log("Serving on port 3000");
});
