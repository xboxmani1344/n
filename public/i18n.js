(() => {
  'use strict';

  // Every string the interface can show, in both languages at once. Pairing
  // them in one array rather than keeping two parallel dictionaries means a key
  // cannot exist in English and quietly go missing in Persian.
  //
  //   key: [English, Persian]
  //
  const STRINGS = {
    // --- language switch -----------------------------------------------------
    'lang.switch': ['فارسی', 'English'],
    'lang.switch.aria': ['Switch to Persian', 'Switch to English'],

    // --- first-run key setup -------------------------------------------------
    'setup.tagline': ['One quick thing before we start', 'قبل از شروع، فقط یک کار'],
    'setup.lead': [
      'Buddy needs an AI key to do the actual teaching. A free Google Gemini key works and takes about a minute — no credit card.',
      'Buddy برای درس‌دادن به یک کلید هوش مصنوعی نیاز دارد. کلید رایگان Google Gemini کار می‌کند و گرفتنش حدود یک دقیقه طول می‌کشد — بدون کارت بانکی.',
    ],
    'setup.step1': ['Open', 'برو به'],
    'setup.step2html': ['Click <strong>Create API key</strong>', 'روی <strong>Create API key</strong> بزن'],
    'setup.step3': ['Copy it, then paste it below', 'کپی‌اش کن و پایین بچسبان'],
    'setup.placeholder': ['Paste your API key here', 'کلیدت را اینجا بچسبان'],
    'setup.submit': ['Save and start studying', 'ذخیره کن و شروع کن'],
    'setup.submitting': ['Checking your key...', 'در حال بررسی کلید...'],
    'setup.note': [
      'Your key is saved to a file on this computer only. It is never sent anywhere except Google.',
      'کلیدت فقط در یک فایل روی همین کامپیوتر ذخیره می‌شود و جایی جز سرویس هوش مصنوعی فرستاده نمی‌شود.',
    ],

    // --- sign in -------------------------------------------------------------
    'auth.tagline': ['Sign in to start studying', 'وارد شو تا شروع کنیم'],
    'auth.login': ['Log In', 'ورود'],
    'auth.signup': ['Sign Up', 'ثبت‌نام'],
    'auth.create': ['Create Account', 'ساختن حساب'],
    'auth.email': ['Email', 'ایمیل'],
    'auth.password': ['Password', 'رمز عبور'],
    'auth.name': ['Name', 'نام'],
    'auth.passwordMin': ['Password (min. 8 characters)', 'رمز عبور (حداقل ۸ کاراکتر)'],
    'auth.or': ['or', 'یا'],
    // --- legal pages ---------------------------------------------------------
    'legal.privacy': ['Privacy', 'حریم خصوصی'],
    'legal.terms': ['Terms', 'شرایط استفاده'],
    'auth.consent': ['By creating an account you agree to the', 'با ساختن حساب،'],
    'auth.consentAnd': ['and', 'و'],
    'auth.consentEnd': ['.', 'را می‌پذیری.'],

    'auth.google': ['Continue with Google', 'ادامه با گوگل'],
    'auth.googleOff': ['Google sign-in not configured yet', 'ورود با گوگل هنوز تنظیم نشده'],

    // --- sidebar / navigation ------------------------------------------------
    'nav.chats': ['Chats', 'گفتگوها'],
    'nav.planner': ['Planner', 'برنامه‌ریز'],
    'nav.video': ['Video', 'ویدیو'],
    'nav.settings': ['Settings', 'تنظیمات'],
    'nav.logout': ['Log out', 'خروج'],
    'nav.new.study': ['+ Study session', '+ جلسه‌ی درس'],
    'nav.new.workout': ['+ Workout plan', '+ برنامه‌ی تمرین'],
    'nav.new.diet': ['+ Nutrition plan', '+ برنامه‌ی تغذیه'],
    'nav.new.tutor': ['+ Ask AI Teacher', '+ سؤال از معلم هوش مصنوعی'],
    'nav.new.code': ['+ Buddy Code', '+ بادی کد'],
    'nav.locked': ['{track} — needs the {plan} plan', '{track} — نیاز به اشتراک {plan}'],
    'track.code.title': ['Buddy Code', 'بادی کد'],
    'track.code.sub': ['Build it, don\u2019t paste it.', 'بساز، کپی نکن.'],
    'track.code.welcome': [
      "What are you building, and in what language? Show me it working the way you want it to - an example beats a description. And tell me what you have written so far, even if it is nothing.",
      'داری چی می‌سازی، و با چه زبانی؟ یک نمونه از کاری که می‌خواهی بکند نشانم بده — مثال از توضیح بهتر است. و بگو تا حالا چقدرش را نوشته‌ای، حتی اگر هیچی.',
    ],
    'err.trackLocked': [
      'That track needs the {plan} plan.',
      'این مسیر به اشتراک {plan} نیاز دارد.',
    ],
    'plan.basic': ['Basic', 'پایه'],
    'plan.plus': ['Plus', 'پلاس'],
    'plan.pro': ['Pro', 'پرو'],
    'nav.recent': ['Recent chats', 'گفتگوهای اخیر'],
    'nav.noChats': ['No chats yet — start one above.', 'هنوز گفتگویی نیست — از بالا یکی شروع کن.'],

    // --- tracks --------------------------------------------------------------
    'track.study.title': ['Study session', 'جلسه‌ی درس'],
    'track.study.sub': ['Four phases. One session.', 'چهار فاز. یک جلسه.'],
    'track.study.welcome': [
      "What would you like to study today, and what's your goal for this session (understand a concept, prep for a test, review before an exam)?",
      'امروز می‌خواهی چه چیزی بخوانی، و هدفت از این جلسه چیست؟ (فهمیدن یک مفهوم، آماده‌شدن برای آزمون، یا مرور قبل از امتحان)',
    ],
    'track.workout.title': ['Workout plan', 'برنامه‌ی تمرین'],
    'track.workout.sub': ['Assess, plan, train, adjust.', 'ارزیابی، برنامه، تمرین، تنظیم.'],
    'track.workout.welcome': [
      "Let's build something you'll actually keep up. Tell me roughly how active you are right now, what equipment you can get to, and how many days a week are genuinely free.",
      'بیا چیزی بسازیم که واقعاً بتوانی ادامه‌اش بدهی. بگو الان تقریباً چقدر فعالی، به چه وسایلی دسترسی داری، و هفته‌ای واقعاً چند روزت آزاد است.',
    ],
    'track.diet.title': ['Nutrition plan', 'برنامه‌ی تغذیه'],
    'track.diet.sub': ['Small changes that stick.', 'تغییرهای کوچکی که می‌مانند.'],
    'track.diet.welcome': [
      "Let's start with how you eat now — no counting, no judgement. What does a normal day of food look like for you, and what are the meals you'd never want to give up?",
      'بیا از همین الان شروع کنیم — بدون شمردن کالری و بدون قضاوت. یک روز عادی غذا خوردنت چه شکلی است، و کدام غذاها هستند که هیچ‌وقت نمی‌خواهی کنار بگذاری؟',
    ],
    'track.tutor.title': ['AI Teacher', 'معلم هوش مصنوعی'],
    'track.tutor.sub': ['Ask anything, any time.', 'هر سؤالی، هر وقتی.'],
    'track.tutor.foot': ['AI Teacher — freeform chat', 'معلم هوش مصنوعی — گفتگوی آزاد'],

    // --- chat ----------------------------------------------------------------
    'chat.brand': ['Buddy', 'Buddy'],
    'chat.phasesAria': ['Session phases', 'فازهای جلسه'],
    'chat.placeholder': ['Message Buddy…', 'پیامت را بنویس…'],
    'chat.send': ['Send', 'ارسال'],
    'chat.nextPhase': ['Next Phase', 'فاز بعدی'],
    'chat.thinking': ['Thinking', 'در حال فکر کردن'],
    'chat.step': ['{label} — step {n} of {total}', '{label} — قدم {n} از {total}'],
    'chat.delete': ['Delete chat', 'حذف گفتگو'],
    'chat.keyBannerHtml': [
      '<strong>Add your free AI key to start studying.</strong> It takes a minute and no card is needed.',
      '<strong>برای شروع، کلید رایگان هوش مصنوعی‌ات را اضافه کن.</strong> یک دقیقه طول می‌کشد و کارت بانکی نمی‌خواهد.',
    ],
    'chat.keyBannerBtn': ['Add key', 'افزودن کلید'],

    // --- planner -------------------------------------------------------------
    'planner.title': ['Planner', 'برنامه‌ریز'],
    'planner.tagline': ['Assignments and due dates, at a glance.', 'تکالیف و مهلت‌ها، یک‌جا.'],
    'planner.prevMonth': ['Previous month', 'ماه قبل'],
    'planner.nextMonth': ['Next month', 'ماه بعد'],
    'planner.today': ['Today', 'امروز'],
    'planner.newTask': ['New task…', 'کار جدید…'],
    'planner.dueDate': ['Due date', 'مهلت'],
    'planner.subject': ['Subject', 'درس'],
    'planner.add': ['Add', 'افزودن'],
    'planner.allTasks': ['All tasks', 'همه‌ی کارها'],
    'planner.tasksOn': ['Tasks — {date}', 'کارهای {date}'],
    'planner.clearFilter': ['Clear filter', 'حذف فیلتر'],
    'planner.noTasks': ['Nothing here yet.', 'هنوز چیزی اینجا نیست.'],
    'planner.deleteTask': ['Delete task', 'حذف کار'],

    // --- video ---------------------------------------------------------------
    'video.title': ['Video Summarizer', 'خلاصه‌ساز ویدیو'],
    'video.tagline': ['Turn any YouTube video into study notes.', 'هر ویدیوی یوتیوب را به جزوه تبدیل کن.'],
    'video.placeholder': ['Paste a YouTube link…', 'لینک یوتیوب را بچسبان…'],
    'video.submit': ['Summarize', 'خلاصه کن'],
    'video.working': ['Summarizing…', 'در حال خلاصه‌کردن…'],
    'video.fallbackLabel': [
      'You can paste the transcript in yourself instead:',
      'می‌توانی به‌جایش خودت متن ویدیو را اینجا بچسبانی:',
    ],
    'video.transcriptPlaceholder': ["Paste the video's transcript here…", 'متن ویدیو را اینجا بچسبان…'],
    'video.manualSubmit': ['Summarize pasted transcript', 'خلاصه‌کردن متن چسبانده‌شده'],
    'video.recent': ['Recent summaries', 'خلاصه‌های اخیر'],
    'video.source': ['YouTube', 'یوتیوب'],

    // --- settings ------------------------------------------------------------
    'settings.title': ['Settings', 'تنظیمات'],
    'settings.tagline': ['Your profile, theme, and plan.', 'پروفایل، ظاهر و اشتراک.'],
    'settings.profile': ['Profile', 'پروفایل'],
    'settings.yourName': ['Your name', 'نام تو'],
    'settings.saveProfile': ['Save profile', 'ذخیره‌ی پروفایل'],
    'settings.saved': ['Saved.', 'ذخیره شد.'],
    'settings.appearance': ['Appearance', 'ظاهر'],
    'settings.themeSystem': ['System', 'سیستم'],
    'settings.themeLight': ['Light', 'روشن'],
    'settings.themeDark': ['Dark', 'تیره'],
    'settings.language': ['Language', 'زبان'],
    'settings.password': ['Password', 'رمز عبور'],
    'settings.currentPassword': ['Current password', 'رمز فعلی'],
    'settings.newPassword': ['New password', 'رمز جدید'],
    'settings.min8': ['At least 8 characters', 'حداقل ۸ کاراکتر'],
    'settings.passwordUpdated': ['Password updated.', 'رمز عبور عوض شد.'],
    'settings.updatePassword': ['Update password', 'تغییر رمز'],
    'settings.aiKey': ['AI key', 'کلید هوش مصنوعی'],
    'settings.checking': ['Checking...', 'در حال بررسی...'],
    'settings.keySaved': ['Key saved.', 'کلید ذخیره شد.'],
    'settings.saveKey': ['Save key', 'ذخیره‌ی کلید'],
    'settings.remove': ['Remove', 'حذف'],
    'settings.keyPlaceholder': ['Paste your key from your provider', 'کلیدت را از سرویس‌دهنده بگیر و اینجا بچسبان'],
    'settings.keyReplace': ['Paste a new key to replace it', 'برای جایگزینی، کلید جدید را بچسبان'],
    'settings.yourOwnKey': ['Your own AI key', 'کلید هوش مصنوعی خودت'],
    'settings.yourOwnKeyOptional': [
      'Use your own AI key instead (optional)',
      'اگر خواستی، به‌جایش از کلید خودت استفاده کن (اختیاری)',
    ],
    'settings.keySet': [
      'Your own key is set — your sessions run on your quota, not this site’s.',
      'کلید خودت ثبت شده — جلسه‌هایت از سهمیه‌ی خودت مصرف می‌شود، نه سهمیه‌ی سایت.',
    ],
    'settings.keyShared': [
      'Ready to go — this site provides the AI. You can add your own key below if you’d rather use your own quota, but you don’t need to.',
      'آماده‌ای — هوش مصنوعی را خود سایت فراهم می‌کند. اگر ترجیح می‌دهی از سهمیه‌ی خودت استفاده کنی می‌توانی پایین کلید خودت را اضافه کنی، ولی لازم نیست.',
    ],
    'settings.keyMissing': [
      'No key yet — add one below to start. It’s free and takes a minute.',
      'هنوز کلیدی نداری — یکی اضافه کن تا شروع کنیم. رایگان است و یک دقیقه طول می‌کشد.',
    ],
    'settings.keyHelpHtml': [
      'Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>. It’s stored for your account only and used just for your own sessions.',
      'کلید رایگان را از <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> بگیر. فقط روی حساب خودت ذخیره می‌شود و فقط برای جلسه‌های خودت خرج می‌شود.',
    ],
    'settings.plan': ['Plan', 'اشتراک'],
    'settings.planFree': ['Free plan', 'اشتراک رایگان'],
    'settings.planPaid': ['Paid plan', 'اشتراک پولی'],
    'settings.planDefault': [
      'Limited daily AI messages and monthly video summaries.',
      'تعداد پیام روزانه و خلاصه‌ی ویدیوی ماهانه محدود است.',
    ],
    'settings.usage': [
      '{used}/{limit} AI messages today · {vUsed}/{vLimit} video summaries this month',
      '{used}/{limit} پیام امروز · {vUsed}/{vLimit} خلاصه‌ی ویدیو این ماه',
    ],
    'plan.perMonth': ['{price} Toman / month', '{price} تومان در ماه'],
    'plan.current': ['Your plan', 'اشتراک فعلی تو'],
    'plan.choose': ['Choose', 'انتخاب'],
    'plan.messages': ['{n} messages a day', '{n} پیام در روز'],
    'plan.includes': ['Study', 'درس'],
    // --- deleting an account -------------------------------------------------
    'settings.danger': ['Delete account', 'حذف حساب'],
    'settings.dangerBody': [
      'This deletes your account and everything in it — every chat and message, your planner, your saved settings. It cannot be undone. Records of payments you have made are kept for accounting, with your account no longer attached to them.',
      'این کار حساب و همه‌چیز داخلش را پاک می‌کند — همه‌ی گفتگوها و پیام‌ها، برنامه‌ریز، و تنظیماتت. برگشتی ندارد. سابقه‌ی پرداخت‌هایت برای حسابداری نگه داشته می‌شود، بدون اینکه دیگر به حساب تو وصل باشد.',
    ],
    'settings.dangerConfirmPassword': ['Type your password to confirm', 'برای تأیید، رمزت را بنویس'],
    'settings.dangerConfirmEmail': ['Type your email address to confirm', 'برای تأیید، ایمیلت را بنویس'],
    'settings.dangerButton': ['Delete my account', 'حساب من را حذف کن'],
    'settings.dangerDeleting': ['Deleting…', 'در حال حذف…'],

    'plan.discountLabel': ['Discount code', 'کد تخفیف'],
    'plan.discountYours': ['Your code {code} — {percent}% off', 'کد تو: {code} — {percent}٪ تخفیف'],
    'plan.opening': ['Opening the payment page…', 'در حال باز کردن صفحه‌ی پرداخت…'],
    'plan.notConfigured': [
      'Online payment is not set up on this site yet.',
      'پرداخت آنلاین روی این سایت هنوز راه‌اندازی نشده.',
    ],
    'plan.discountBad': ['That discount code cannot be used.', 'این کد تخفیف قابل استفاده نیست.'],
    'payment.ok': ['Payment received — your plan is active.', 'پرداخت انجام شد — اشتراکت فعال شد.'],
    'payment.cancelled': ['Payment cancelled. Nothing was charged.', 'پرداخت لغو شد. مبلغی کم نشد.'],
    'payment.failed': ['The payment did not go through.', 'پرداخت انجام نشد.'],
    'settings.upgrade': ['Upgrade', 'ارتقا'],

    // --- relative time -------------------------------------------------------
    'time.now': ['just now', 'همین الان'],
    'time.mins': ['{n}m ago', '{n} دقیقه پیش'],
    'time.hours': ['{n}h ago', '{n} ساعت پیش'],
    'time.days': ['{n}d ago', '{n} روز پیش'],

    // --- errors --------------------------------------------------------------
    'chat.you': ['You', 'تو'],
    'chat.tutorChat': ['AI Teacher chat', 'گفتگو با معلم هوش مصنوعی'],
    'chat.tutorWelcome': [
      "I'm your AI teacher — ask me anything, on any topic, any time. What's on your mind?",
      'من معلم هوش مصنوعی‌ات هستم — هر سؤالی، از هر موضوعی، هر وقت خواستی بپرس. چه چیزی توی ذهنت است؟',
    ],
    'chat.movingOn': ['Moving on to {phase}', 'می‌رویم سراغ {phase}'],
    'chat.confirmDelete': [
      'Delete this chat? This cannot be undone.',
      'این گفتگو حذف شود؟ برگشتی ندارد.',
    ],
    'chat.limitHint': ['{error} (See Settings to upgrade.)', '{error} (برای ارتقا به تنظیمات برو.)'],
    'planner.nothingDue': ['Nothing due this day.', 'برای این روز چیزی نیست.'],
    'planner.noTasksYet': ['No tasks yet — add one above.', 'هنوز کاری نیست — از بالا یکی اضافه کن.'],
    'planner.noDueDate': ['No due date', 'بدون مهلت'],
    'planner.markDone': ['Mark "{title}" as done', '«{title}» را انجام‌شده علامت بزن'],
    'planner.deleteNamed': ['Delete "{title}"', 'حذف «{title}»'],
    'video.untitled': ['Untitled video', 'ویدیوی بی‌نام'],
    'err.retry': ['Something went wrong. Please try again.', 'یک جای کار ایراد داشت. دوباره امتحان کن.'],
    'err.keyRejected': [
      'That key was rejected. Please check it and try again.',
      'این کلید قبول نشد. یک بار دیگر بررسی‌اش کن.',
    ],
    'err.keyRejectedShort': ['That key was rejected.', 'این کلید قبول نشد.'],
    'err.generic': ['Something went wrong.', 'یک جای کار ایراد داشت.'],
    'err.billingOff': [
      'Upgrades aren’t set up yet — the site owner needs to add Stripe keys.',
      'ارتقای اشتراک هنوز راه‌اندازی نشده — صاحب سایت باید کلیدهای Stripe را اضافه کند.',
    ],

    // --- landing page --------------------------------------------------------
    'lp.nav.tracks': ['Tracks', 'مسیرها'],
    'lp.nav.how': ['How it works', 'چطور کار می‌کند'],
    'lp.nav.more': ['More', 'بیشتر'],
    'lp.nav.open': ['Open the app', 'ورود به برنامه'],
    'lp.eyebrow': ['Study · Train · Eat · Build', 'درس · تمرین · تغذیه · کد'],
    'lp.titleHtml': [
      'One coach.<br />Four phases.<br />Four parts of your life.',
      'یک مربی.<br />چهار فاز.<br />چهار بخش از زندگی‌ات.',
    ],
    'lp.lede': [
      "Not a chatbot that answers and forgets. A coach that works out where you are, builds a plan, walks you through it, then adjusts — for a subject you're learning, a body you're training, or the way you eat.",
      'چت‌باتی نیست که جواب بدهد و فراموش کند. مربی‌ای است که اول می‌فهمد کجای کاری، بعد برنامه می‌سازد، قدم‌به‌قدم همراهت می‌آید و آخرش برنامه را با تو تنظیم می‌کند — برای درسی که می‌خوانی، بدنی که تمرین می‌دهی، یا جوری که غذا می‌خوری.',
    ],
    'lp.cta.start': ['Start free', 'رایگان شروع کن'],
    'lp.cta.how': ['See how it works', 'ببین چطور کار می‌کند'],
    'lp.scroll': ['Scroll', 'اسکرول کن'],
    'lp.tracks.h2': ['Four tracks, one method', 'چهار مسیر، یک روش'],
    'lp.tracks.study.h': ['Study', 'درس'],
    'lp.tracks.study.p': [
      'Warm-Up, Learn, Practice, Review. It finds out what you already know, teaches in chunks, quizzes you until it sticks, then plans when to revisit.',
      'گرم‌کردن، یادگیری، تمرین، مرور. اول می‌فهمد چه چیزی بلدی، بعد تکه‌تکه درس می‌دهد، آن‌قدر سؤال می‌پرسد تا جا بیفتد، و آخر برنامه می‌دهد که کِی دوباره مرورش کنی.',
    ],
    'lp.tracks.workout.h': ['Workout', 'تمرین'],
    'lp.tracks.workout.p': [
      'Assess, Plan, Train, Progress. Built around the kit and the hours you actually have — a three-day plan you keep beats a six-day plan you abandon.',
      'ارزیابی، برنامه، تمرین، پیشرفت. بر اساس وسایل و وقتی که واقعاً داری — برنامه‌ی سه‌روزه‌ای که ادامه بدهی از برنامه‌ی شش‌روزه‌ای که رهایش کنی بهتر است.',
    ],
    'lp.tracks.diet.h': ['Nutrition', 'تغذیه'],
    'lp.tracks.diet.p': [
      'Check In, Shape, Meals, Adjust. Small changes that survive a real week. It adds before it subtracts, and never puts a number on your body.',
      'شروع، چارچوب، وعده‌ها، تنظیم. تغییرهای کوچکی که یک هفته‌ی واقعی را دوام می‌آورند. اول اضافه می‌کند بعد کم، و هیچ‌وقت روی بدنت عدد نمی‌گذارد.',
    ],
    // Phase names for the landing carousel. One string per track, split on the
    // separator at render time, so a translator moves four names as a phrase
    // rather than as four disconnected keys.
    'lp.track.study.phases': [
      'Warm-Up · Learn · Practice · Review',
      'گرم‌کردن · یادگیری · تمرین · مرور',
    ],
    'lp.track.workout.phases': [
      'Assess · Plan · Train · Progress',
      'ارزیابی · برنامه · تمرین · پیشرفت',
    ],
    'lp.track.diet.phases': [
      'Check In · Shape · Meals · Adjust',
      'شروع · چارچوب · وعده‌ها · تنظیم',
    ],
    'lp.track.count': ['Track {n} of {total}', 'مسیر {n} از {total}'],
    'lp.track.goto': ['Show the {name} track', 'نمایش مسیر {name}'],
    'lp.tracks.code.h': ['Buddy Code', 'بادی کد'],
    'lp.tracks.code.p': [
      'Brief, Design, Build, Debug. It will not hand you the finished answer - it gives you the next piece, and teaches you to read the error instead of pasting the fix.',
      'صورت مسئله، طراحی، ساخت، اشکال‌زدایی. جواب آماده بهت نمی‌دهد — تکه‌ی بعدی را می‌دهد و یادت می‌دهد خودت ارور را بخوانی، نه اینکه فقط کپی کنی.',
    ],
    'lp.track.code.phases': [
      'Brief · Design · Build · Debug',
      'صورت مسئله · طراحی · ساخت · اشکال‌زدایی',
    ],
    'lp.phases.eyebrow': ['How a session runs', 'یک جلسه چطور پیش می‌رود'],
    'lp.phases.aria': ['The four phases', 'چهار فاز'],
    'lp.seg.1': ['Assess', 'ارزیابی'],
    'lp.seg.2': ['Plan', 'برنامه'],
    'lp.seg.3': ['Work', 'کار'],
    'lp.seg.4': ['Adjust', 'تنظیم'],
    'lp.sticky.note': ['Every track follows the same four beats.', 'هر سه مسیر همین چهار قدم را دارند.'],
    'lp.step.1.h': ['It asks before it tells', 'اول می‌پرسد، بعد می‌گوید'],
    'lp.step.1.p': [
      "No plan until it knows what it's planning for. What you already understand, what equipment you can reach, what you actually like eating. Two or three questions, not a form.",
      'تا نداند برای چه چیزی برنامه می‌ریزد، برنامه‌ای نمی‌دهد. چه چیزی را بلدی، به چه وسایلی دسترسی داری، چه غذایی را واقعاً دوست داری. دو سه تا سؤال، نه یک فرم بلندبالا.',
    ],
    'lp.step.2.h': ['Then it builds the plan', 'بعد برنامه را می‌سازد'],
    'lp.step.2.p': [
      'Concrete and sized to your week — the concepts to cover, the split to train, the handful of changes to make. Built to fit the constraints you gave it, not an ideal version of you.',
      'مشخص و به اندازه‌ی هفته‌ی تو — مفهوم‌هایی که باید بخوانی، تقسیم‌بندی تمرین، و چند تغییر کوچک. ساخته‌شده برای محدودیت‌هایی که گفتی، نه برای نسخه‌ی ایده‌آل تو.',
    ],
    'lp.step.3.h': ['It works through it with you', 'کنارت جلو می‌رود'],
    'lp.step.3.p': [
      "One question at a time, one block at a time, one meal at a time. It checks how it's landing and slows down or pushes on based on your answers, not a script.",
      'یک سؤال در هر قدم، یک بلوک تمرین در هر قدم، یک وعده در هر قدم. می‌سنجد که داری می‌گیری یا نه، و بر اساس جواب‌های تو آهسته‌تر می‌رود یا جلوتر — نه از روی یک متن آماده.',
    ],
    'lp.step.4.h': ['Then it changes its mind', 'و بعد نظرش را عوض می‌کند'],
    'lp.step.4.p': [
      'What stuck, what didn’t, what to do differently. A missed week is information, not failure — the plan bends to you rather than the other way round.',
      'چه چیزی ماند، چه چیزی نه، و چه چیزی را باید عوض کرد. یک هفته‌ی از دست رفته اطلاعات است، نه شکست — برنامه با تو خم می‌شود، نه برعکس.',
    ],
    'lp.more.h2': ['And the rest of it', 'و بقیه‌اش'],
    'lp.more.tutor.h': ['AI Teacher', 'معلم هوش مصنوعی'],
    'lp.more.tutor.p': [
      "A freeform chat for the one-off question that doesn't need a whole session.",
      'یک گفتگوی آزاد برای سؤالی که ارزش یک جلسه‌ی کامل را ندارد.',
    ],
    'lp.more.planner.h': ['Planner', 'برنامه‌ریز'],
    'lp.more.planner.p': [
      'A calendar and task list for assignments, deadlines and sessions — click a day to filter.',
      'تقویم و لیست کار برای تکالیف، مهلت‌ها و جلسه‌ها — روی یک روز بزن تا فیلتر شود.',
    ],
    'lp.more.video.h': ['Video notes', 'جزوه از ویدیو'],
    'lp.more.video.p': [
      "Paste a YouTube link and get structured study notes from it. Paste a transcript directly if the link won't load.",
      'لینک یوتیوب را بچسبان و از آن جزوه‌ی مرتب بگیر. اگر لینک باز نشد، خودِ متن ویدیو را بچسبان.',
    ],
    'lp.final.h2': [
      'Start with whichever one is bothering you today.',
      'از همانی شروع کن که امروز بیشتر اذیتت می‌کند.',
    ],
    'lp.final.cta': ['Open Buddy', 'ورود به Buddy'],
    'lp.final.fine': [
      'Free to use. Training and nutrition guidance here is general — anything medical belongs with a doctor.',
      'استفاده از آن رایگان است. راهنمایی تمرین و تغذیه اینجا عمومی است — هر چیز پزشکی را باید از دکتر بپرسی.',
    ],
  };

  const LANGS = ['en', 'fa'];
  const RTL = { fa: true };
  const STORAGE_KEY = 'studybuddy.lang';

  function normalize(value) {
    return LANGS.includes(value) ? value : null;
  }

  // The same detection the inline <head> script runs, kept here so both agree.
  function detect() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode, or storage blocked. Fall through to the browser's own hint.
    }
    return normalize(stored) || (String(navigator.language || '').toLowerCase().startsWith('fa') ? 'fa' : 'en');
  }

  let current = normalize(document.documentElement.lang) || detect();

  function t(key, vars) {
    const pair = STRINGS[key];
    if (!pair) return key;
    let out = pair[current === 'fa' ? 1 : 0] || pair[0];
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
    }
    return out;
  }

  // --- numerals --------------------------------------------------------------
  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  // Display only. Anything that will be parsed, stored, or put into an <input>
  // must keep ASCII digits, so this is applied at the point of rendering and
  // never to a value on its way anywhere else.
  function num(value) {
    const s = String(value);
    if (current !== 'fa') return s;
    return s.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
  }

  // --- the Persian (Jalali) calendar -----------------------------------------
  // Intl already knows the conversion, so there is no arithmetic to get wrong
  // and no library to add. UTC throughout: these are calendar dates, and using
  // local time would shift them by a day for anyone east or west of the server.

  const JALALI_PARTS = new Intl.DateTimeFormat('en-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const DAY_MS = 86400000;

  const JALALI_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];

  const GREGORIAN_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const GREGORIAN_SHORT = GREGORIAN_MONTHS.map((m) => m.slice(0, 3));

  const WEEKDAYS = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    fa: ['شنبه', '۱ش', '۲ش', '۳ش', '۴ش', '۵ش', 'جمعه'],
  };

  function utc(y, m, d) {
    return new Date(Date.UTC(y, m, d));
  }

  function toJalali(date) {
    const parts = JALALI_PARTS.formatToParts(date);
    const value = (type) => Number(parts.find((p) => p.type === type).value);
    return { jy: value('year'), jm: value('month'), jd: value('day') };
  }

  // Going the other way has no Intl equivalent. 1 Farvardin lands on 20 or 21
  // March, so an estimate from that anchor is never more than a couple of days
  // out; the loop walks the rest and is exact by construction.
  function fromJalali(jy, jm, jd) {
    const daysBefore = jm <= 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;
    const guess = Date.UTC(jy + 621, 2, 21) + (daysBefore + jd - 1) * DAY_MS;
    for (let offset = -5; offset <= 5; offset += 1) {
      const candidate = new Date(guess + offset * DAY_MS);
      const j = toJalali(candidate);
      if (j.jy === jy && j.jm === jm && j.jd === jd) return candidate;
    }
    return new Date(guess);
  }

  function isoOf(date) {
    return date.toISOString().slice(0, 10);
  }

  function isoParts(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return utc(y, m - 1, d);
  }

  // A cursor is whichever month the calendar is showing, in whichever calendar
  // system the language uses. Everything outside this file speaks Gregorian ISO
  // strings, so the calendar system never leaks into storage or the API.
  function cursorFor(iso) {
    const date = isoParts(iso);
    if (current === 'fa') {
      const { jy, jm } = toJalali(date);
      return { y: jy, m: jm };
    }
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
  }

  function stepCursor(cursor, delta) {
    let m = cursor.m + delta;
    let y = cursor.y;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
    return { y, m };
  }

  function monthStart(cursor) {
    return current === 'fa' ? fromJalali(cursor.y, cursor.m, 1) : utc(cursor.y, cursor.m - 1, 1);
  }

  function monthLength(cursor) {
    const start = monthStart(cursor);
    const nextStart = monthStart(stepCursor(cursor, 1));
    return Math.round((nextStart - start) / DAY_MS);
  }

  // Persian weeks begin on Saturday, English ones on Sunday.
  function columnOf(date) {
    const dow = date.getUTCDay(); // 0 = Sunday
    return current === 'fa' ? (dow + 1) % 7 : dow;
  }

  function monthLabel(cursor) {
    if (current !== 'fa') return `${GREGORIAN_MONTHS[cursor.m - 1]} ${cursor.y}`;

    // Both calendars, as asked: the Jalali month named, and the Gregorian
    // months it straddles alongside it — a Jalali month always spans two.
    const start = monthStart(cursor);
    const end = new Date(start.getTime() + (monthLength(cursor) - 1) * DAY_MS);
    const from = GREGORIAN_SHORT[start.getUTCMonth()];
    const to = GREGORIAN_SHORT[end.getUTCMonth()];
    const years = start.getUTCFullYear() === end.getUTCFullYear()
      ? String(start.getUTCFullYear())
      : `${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
    const span = from === to ? from : `${from}–${to}`;
    return `${JALALI_MONTHS[cursor.m - 1]} ${num(cursor.y)} · ${span} ${years}`;
  }

  // Six rows of seven, the same shape the Gregorian grid already produced, with
  // each cell carrying the Gregorian ISO date it stands for.
  function monthGrid(cursor) {
    const start = monthStart(cursor);
    const length = monthLength(cursor);
    const lead = columnOf(start);
    const cells = [];

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start.getTime() + (i - lead) * DAY_MS);
      const inMonth = i >= lead && i < lead + length;
      const dayNumber = current === 'fa' ? toJalali(date).jd : date.getUTCDate();
      cells.push({ iso: isoOf(date), label: num(dayNumber), outside: !inMonth });
    }
    return cells;
  }

  function weekdayNames() {
    return WEEKDAYS[current] || WEEKDAYS.en;
  }

  // Short form for a task's due date. In Persian both calendars are shown, so
  // a date copied off a syllabus written either way is still recognisable.
  function formatShortDate(iso) {
    const date = isoParts(iso);
    if (current !== 'fa') {
      return `${GREGORIAN_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
    }
    const { jm, jd } = toJalali(date);
    return `${num(jd)} ${JALALI_MONTHS[jm - 1]} (${GREGORIAN_SHORT[date.getUTCMonth()]} ${date.getUTCDate()})`;
  }

  function formatLongDate(iso) {
    const date = isoParts(iso);
    if (current !== 'fa') {
      return `${GREGORIAN_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
    }
    const { jy, jm, jd } = toJalali(date);
    return `${num(jd)} ${JALALI_MONTHS[jm - 1]} ${num(jy)} (${GREGORIAN_SHORT[date.getUTCMonth()]} ${date.getUTCDate()})`;
  }

  function relativeTime(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('time.now');
    if (mins < 60) return t('time.mins', { n: num(mins) });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t('time.hours', { n: num(hours) });
    return t('time.days', { n: num(Math.round(hours / 24)) });
  }

  // --- applying a language ---------------------------------------------------

  function fillStaticText(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });
    // Bare numerals in the markup -- step numbers, the tracker's 1-2-3-4. The
    // first pass keeps the original so switching back to English restores the
    // Latin digits rather than reading the Persian ones it just wrote.
    scope.querySelectorAll('[data-i18n-num]').forEach((el) => {
      if (el.dataset.numSource === undefined) el.dataset.numSource = el.textContent;
      el.textContent = num(el.dataset.numSource);
    });
  }

  function applyLanguage(lang, options) {
    const next = normalize(lang) || 'en';
    current = next;

    const root = document.documentElement;
    root.lang = next;
    root.dir = RTL[next] ? 'rtl' : 'ltr';
    root.dataset.lang = next;

    fillStaticText();
    delete root.dataset.i18nPending;

    if (!options || options.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not fatal: the account setting still carries the choice across.
      }
    }

    // Anything rendered from JavaScript re-renders itself on this.
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: next } }));
  }

  function storedLang() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  window.I18N = {
    get lang() {
      return current;
    },
    get isRtl() {
      return Boolean(RTL[current]);
    },
    languages: LANGS,
    t,
    num,
    detect,
    storedLang,
    applyLanguage,
    fillStaticText,
    relativeTime,
    formatShortDate,
    formatLongDate,
    cursorFor,
    stepCursor,
    monthGrid,
    monthLabel,
    weekdayNames,
    isoOf,
    todayIso: () => {
      const now = new Date();
      return isoOf(utc(now.getFullYear(), now.getMonth(), now.getDate()));
    },
  };
})();
