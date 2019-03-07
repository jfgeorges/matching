// 0 : lundi, 6 : dimanche

const dateFns = require("date-fns");
const timeToSlot = require("./timeToSlot");
const slotToTime = require("./slotToTime");

//////////////////////////////////////////////////////////
//        DONNEES EN ENTREE RECUPEREE DE MONGOOSE       //
//////////////////////////////////////////////////////////
// Structure du Availibilities : [{dayNumber, startingSlot, endingSlot}, {dayNumber, startingSlot, endingSlot}, ...]
const proWeekDaysAvailabilities = [
  { dayNumber: 1, startingTime: "0930", endingTime: "1230" },
  { dayNumber: 1, startingTime: "1400", endingTime: "1730" },
  { dayNumber: 4, startingTime: "1400", endingTime: "1800" },
  { dayNumber: 5, startingTime: "2000", endingTime: "2359" },
  { dayNumber: 6, startingTime: "1730", endingTime: "1800" }
];

const patientWeekDaysAvailabilities = [
  { dayNumber: 1, startingTime: "1030", endingTime: "1230" },
  { dayNumber: 1, startingTime: "1400", endingTime: "1730" },
  { dayNumber: 4, startingTime: "1400", endingTime: "1800" },
  { dayNumber: 6, startingTime: "1400", endingTime: "1800" }
];

// Config par défaut et marges à appliquer sur les ordonnances
const PrescriptionConfig = {
  DefaultSessionsPerWeek: 3,
  DefaultNumberOfSessions: 20,
  chronicMargin: 20,
  acuteMargin: 3
};
// RDV DU PRO
// Requète mongoose pour récupérer tous les rdv du pro sur la période
// retourne un tableau :
const appointments = [
  {
    idPro: "1234567",
    date: "20190305",
    time: "1030"
  },
  {
    idPro: "1234567",
    date: "20190308",
    time: "1530"
  },
  {
    idPro: "1234567",
    date: "20190308",
    time: "1400"
  }
];

// ABSENCE DU PRO
// Requète mongoose pour récupérer toutes les absences du pro sur la période
// retourne un tableau :
const absences = [
  { date: "20190310", startingTime: "1030", endingTime: "1300" },
  { date: "20190308", startingTime: "1430", endingTime: "1530" },
  { date: "20190308", startingTime: "1600", endingTime: "1630" }
];

//////////////////////////////////////////////////////////
//               FONCTIONS DE MATCHING                  //
//////////////////////////////////////////////////////////
// Conversion des Heures et Minutes en slot, add startingSlot and endingSlot to initial object
// Input tableau d'objet avec propriétés startingTime et endingTime
const convertTimeFormatToSlot = arrayOfTimeAvalaibilities => {
  const arrayOfSlot = [];
  let endSlot = 0;
  for (let i = 0; i < arrayOfTimeAvalaibilities.length; i++) {
    // Si l'heure de fin = "2359", on prend le dernier slot = 47 (correspondant à "2330') sinon on prend le slot - 1
    endSlot = arrayOfTimeAvalaibilities[i].endingTime === "2359" ? 47 : timeToSlot[arrayOfTimeAvalaibilities[i].endingTime] - 1;
    arrayOfSlot.push({
      ...arrayOfTimeAvalaibilities[i],
      startingSlot: timeToSlot[arrayOfTimeAvalaibilities[i].startingTime],
      endingSlot: endSlot
    });
  }
  return arrayOfSlot;
};
////////////////////////////////////////////////////////////////////
//            CONVERSION EN OBJET AVEC LA DATE EN PROP            //
////////////////////////////////////////////////////////////////////
// ABSENCES
// Conversion en un objet avec la structure suivante :
// { '20190308':
//    [ { startingSlot: 29, endingSlot: 35 },
//      { startingSlot: 23, endingSlot: 25 } ],
//   '20190310': [ { startingSlot: 21, endingSlot: 26 } ] }
// Cela permet d'accéder directement à la date pour trouver les absences
// (stockées dans une tableau pour prendre en compte plusieurs absences par jour)
const absencePerDate = absencesArray => {
  return absencesArray.reduce((obj, absence) => {
    if (obj[absence.date] === undefined) {
      obj[absence.date] = [{ startingSlot: absence.startingSlot, endingSlot: absence.endingSlot }];
    } else {
      obj[absence.date].push({ startingSlot: absence.startingSlot, endingSlot: absence.endingSlot });
    }
    return obj;
  }, {});
};
const proAbsences = absencePerDate(convertTimeFormatToSlot(absences));

// fonction qui complète avec les créneaux d'absence une fois traités par absencePerDate()
const addProAbsencesOfTheDay = (slotsArray, absenceDate) => {
  if (proAbsences[absenceDate]) {
    for (let i = 0; i < proAbsences[absenceDate].length; i++) {
      for (slot = proAbsences[absenceDate][i].startingSlot; slot <= proAbsences[absenceDate][i].endingSlot; slot++) {
        slotsArray[slot].available = false;
      }
    }
  }
  return slotsArray;
};
// APPOINTMENTS
// Conversion en un objet avec la structure suivante :
// { '20190308':
//    [ { slot: 29 },
//      { slot: 23 } ],
//   '20190310': [ { slot: 21 } ] }
// Cela permet d'accéder directement à la date pour trouver les rendez-vous
// (stockées dans une tableau pour prendre en compte tous les rendez-vous du jour)
const appointmentPerDate = appointmentsArray => {
  return appointmentsArray.reduce((obj, appointment) => {
    if (obj[appointment.date] === undefined) {
      obj[appointment.date] = [{ slot: timeToSlot[appointment.time] }];
    } else {
      obj[appointment.date].push({ slot: timeToSlot[appointment.time] });
    }
    return obj;
  }, {});
};
const proAppointments = appointmentPerDate(appointments);

// fonction qui complète avec les créneaux des rdv déjà pris une fois traités par appointmentPerDate()
const addProappointmentOfTheDay = (slotsArray, appointmentDate) => {
  if (proAppointments[appointmentDate]) {
    for (let i = 0; i < proAppointments[appointmentDate].length; i++) {
      slotsArray[proAppointments[appointmentDate][i].slot].available = false;
    }
  }
  return slotsArray;
};

// Renvoie le lundi de la semaine au format string YYYYMMDD
// Input : date au format string
const strMondayDate = strDateYYYYMMDD => {
  return dateFns.format(dateFns.startOfWeek(dateFns.parse(strDateYYYYMMDD), { weekStartsOn: 1 }), "YYYYMMDD");
};

// Fonction fillinSlots(bookingSlot)
// Initialise le tableau des dispos sur la semaine
// Renvoi un tableau des dispo de la semaine
const fillinSlots = bookingSlot => {
  const slotToFillIn = [[], [], [], [], [], [], []];

  for (let i = 0; i < bookingSlot.length; i++) {
    // Initalisation du tableau pour le jour 'dayNumber' avec les 48 créneaux non dispo
    if (slotToFillIn[bookingSlot[i].dayNumber].length === 0) {
      for (let j = 0; j < 48; j++) {
        slotToFillIn[bookingSlot[i].dayNumber].push({ available: false });
      }
    }
    // Remplissage des créneaux dispo, chaque slot correspond à un créneau de 30'
    for (slot = bookingSlot[i].startingSlot; slot <= bookingSlot[i].endingSlot; slot++) {
      slotToFillIn[bookingSlot[i].dayNumber][slot].available = true;
    }
  }
  return slotToFillIn;
};

// Match les dispos par semaine
const checkWeekAvailabilities = (startingDate, patientSlots, proSlots, sessionsByWeek) => {
  const slotToBook = [];
  // Parcours des jours de dispo patient
  for (let patientDay = startingDate.dayOfTheWeek; patientDay < patientSlots.length; patientDay++) {
    // Si patient et pro se sont déclarés dispo le même jour

    if (patientSlots[patientDay].length > 0 && proSlots[patientDay].length > 0) {
      // A partir d'ici on tient compte des dates
      const absenceDate = dateFns.format(dateFns.addDays(startingDate.mondayDate, patientDay), "YYYYMMDD"); // Génère la date du jour de la semaine traité
      // Récup des absences du pro pour le jour absenceDate
      // console.log("---- AVANT -----", absenceDate, patientDay);
      // console.log(proSlots[patientDay]);
      proSlots[patientDay] = addProAbsencesOfTheDay(proSlots[patientDay], absenceDate);
      // Récup des rdv du jour déjà dans le calendrier (Appointment)
      proSlots[patientDay] = addProappointmentOfTheDay(proSlots[patientDay], absenceDate);
      // Parcours des 48 slots de la journée
      for (let slot = 0; slot < 48; slot++) {
        // Sont-ils tous les 2 dispos au même horaire ?
        if (patientSlots[patientDay][slot].available === true && proSlots[patientDay][slot].available === true) {
          // 1 créneau commun pour ce jour => on sort de la boucle pour checker un jour suivant
          slotToBook.push({ appointmentDate: absenceDate, dayNumber: patientDay, Slot: slot, Time: slotToTime[slot] });
          break;
        }
      }
    }
    // Si l'on a trouvé le nombre de créneaux
    if (slotToBook.length === sessionsByWeek) {
      break;
    }
  }
  return slotToBook;
};

//////////////////////////////////////////////////////////
//                LANCEMENT DE L'ALGO                   //
//////////////////////////////////////////////////////////

/////////////////
// PARAMETRAGE //
/////////////////
// PRESCRIPTION DU PATIENT
const patientPrescription = {
  beginDate: "20190305",
  totalSessions: 5,
  sessionsPerWeek: 2,
  isChronic: true
};
// Paramètres en entré de l'algo
const matchingParameters = { ...patientPrescription };

if (matchingParameters.totalSessions === 0) {
  matchingParameters.totalSessions = PrescriptionConfig.DefaultNumberOfSessions;
}
if (matchingParameters.sessionsPerWeek === 0) {
  matchingParameters.sessionsPerWeek = PrescriptionConfig.DefaultSessionsPerWeek;
}
// Ajout des marges de séances en fonction de la chronicité
// Math.max peut proposer plus de séance qu'une semaine type d'un patient,
// C'est moins grave dans ce sens, car il est facile d'annuler une séance
matchingParameters.totalSessions +=
  matchingParameters.isChronic === true
    ? PrescriptionConfig.chronicMargin
    : Math.max(matchingParameters.sessionsPerWeek, PrescriptionConfig.acuteMargin);

// date-fns : lundi = 1, pour l'utilisation dans l'algo, lundi est ramené à 0 (1er indice du tableau des jours de la semaine)
matchingParameters.startingDate = {
  date: patientPrescription.beginDate,
  dayOfTheWeek: dateFns.getISODay(patientPrescription.beginDate) - 1,
  mondayDate: strMondayDate(patientPrescription.beginDate)
};
// matchingParameters.firstMonday = strMondayDate(matchingParameters.startingDate.date);
// weekNumber = dateFns.getISOWeek(matchingParameters.startingDate.date);

// calculer le nombre de rdv déjà trouvés et faire tourner l'algo X semaines supplémentaires
// en fonction du nombre de séances manquantes et du nombre de sesionsPerWeek

const patientPlanning = [];

// DETERMINER LA PERIODE ( = nombre de semaines)
// 20 séances si rien sur l'ordonnance, si chronique x2, si aigüe, ajout d'une semaine type : +3 séances si rien sur ordo
// >= Prescription.beginDate juqu'à (nombre de séance prescrite + marge sécu)
// Si - de rdv par semaine que demandé, proposer d'autres créneaux avec le même kiné ou un autre kiné sur les créneaux

let error = false;
let nbLoop = 0;
let nbFoundSessions = 0;

const patientAvailabilities = fillinSlots(convertTimeFormatToSlot(patientWeekDaysAvailabilities));
const proAvailabilities = fillinSlots(convertTimeFormatToSlot(proWeekDaysAvailabilities));

while (nbFoundSessions < matchingParameters.totalSessions && error === false) {
  // On repart de la copie vierge du tableau des dispos déclarées
  // ATTENTION A FAIRE UNE COPIE EN PROFONDEUR CAR LES OBJETS NE SONT PAS COPIES MAIS TRANSMIS EN REFERENCE EN FAISANT UN SPREAD DU TABLEAU
  // ON RECUPERE ALORS LES MEMES OBJECTS DANS LE NOUVEAU TABLEAU
  // const proAvailabilitiesCopy = JSON.parse(JSON.stringify(proAvailabilities)); // La solution JSON est moins performante que le double map

  const proAvailabilitiesCopy = proAvailabilities.map(e1 =>
    e1.map(e2 => ({
      available: e2["available"]
    }))
  );

  patientPlanning.push(
    checkWeekAvailabilities(matchingParameters.startingDate, patientAvailabilities, proAvailabilitiesCopy, matchingParameters.sessionsPerWeek)
  );
  // Calcul le nombre de séances trouvées (cumul des semaines)
  nbFoundSessions = patientPlanning.reduce((nbSessions, week) => {
    return (nbSessions += week.length);
  }, 0);

  // MAJ de startingDate pour la nouvelle itération 'date' et 'mondayDate' passe à la date du lundi suivant
  matchingParameters.startingDate.mondayDate = dateFns.format(dateFns.addDays(matchingParameters.startingDate.mondayDate, 7), "YYYYMMDD");
  matchingParameters.startingDate.date = matchingParameters.startingDate.mondayDate;
  matchingParameters.startingDate.dayOfTheWeek = 0;

  nbLoop++;
  if (nbLoop === 200) {
    console.log("true");
    error = true;
  }
}

if (!error) {
  // Comme on relance l'algo sur une semaine complète, la dernière semaine peut contenir qq séances en trop
  const extraSessions = nbFoundSessions - matchingParameters.totalSessions;
  for (let i = 0; i < extraSessions; i++) {
    patientPlanning[patientPlanning.length - 1].pop();
  }
} else {
  console.log("ERREUR");
}
console.log(patientPlanning);
