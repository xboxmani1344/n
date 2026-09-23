'use strict';

// What build this checkout would be, so it can be compared against the `build`
// line in a deploy's log. Same value means the running container is this code.
console.log(require('../src/version').STAMP);
