export const MOCK_DATA = {
  doctors: [
    {
      id: "D204",
      name: "Dr. Sharma",
      specialization: "Cardiologist",
      experience: "14 Yrs",
      rating: "4.9",
      slots: ["09:00", "09:30", "10:30", "11:00", "12:00", "14:30"],
      bookedSlots: ["10:00", "11:30"],
    },
    {
      id: "D205",
      name: "Dr. Ananya Iyer",
      specialization: "Neurologist",
      experience: "10 Yrs",
      rating: "4.8",
      slots: ["10:00", "10:30", "11:30", "15:00", "16:00"],
      bookedSlots: ["09:00", "14:00"],
    },
  ],
  beds: [
    { ward: "ICU", total: 20, occupied: 17, available: 3, critical: true },
    { ward: "Emergency Trauma", total: 15, occupied: 12, available: 3, critical: true },
    { ward: "General Male Ward", total: 40, occupied: 28, available: 12, critical: false },
    { ward: "General Female Ward", total: 40, occupied: 24, available: 16, critical: false },
    { ward: "Pediatric Ward", total: 25, occupied: 10, available: 15, critical: false },
  ],
  activeToken: {
    token_number: 27,
    patient_name: "Rahul Verma",
    doctor_name: "Dr. Sharma (Cardiology)",
    people_ahead: 4,
    estimated_wait_minutes: 40,
    current_running_token: 23,
    status: "WAITING",
  },
};