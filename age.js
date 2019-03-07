const dateFns = require("date-fns");

const getAge = birthDay => {
  const birthDate = dateFns.parse(birthDay);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// console.log(getAge("19760306"));

// console.log("isFuture 19760306: " + dateFns.isFuture("19760306"));
// console.log("isEqual 20190305: " + dateFns.isEqual(dateFns.parse("20190305"), Date()));
// console.log("isFuture 20190306: " + dateFns.isFuture("20190306"));

console.log("20190305: " + (dateFns.getISODay("20190305") - 1));
