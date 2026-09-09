export const LAUNCH_CITIES = [
  'Chennai',
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Jaipur',
  'Varanasi',
  'Kochi'
] as const;

export const INDIAN_CITIES: string[] = [
  // 8 Launch Cities
  'Chennai', 'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Jaipur', 'Varanasi', 'Kochi',

  // Major Metros & Capital Cities
  'Kolkata', 'Ahmedabad', 'Pune', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Guntur',
  'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot',
  'Kalyan-Dombivli', 'Vasai-Virar', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad',
  'Amritsar', 'Navi Mumbai', 'Allahabad', 'Prayagraj', 'Ranchi', 'Howrah', 'Coimbatore',
  'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota',
  'Guwahati', 'Chandigarh', 'Solapur', 'Hubballi', 'Dharwad', 'Bareilly', 'Moradabad',
  'Mysore', 'Gurgaon', 'Gurugram', 'Aligarh', 'Jalandhar', 'Tiruchirappalli', 'Bhubaneswar',
  'Salem', 'Mira-Bhayandar', 'Warangal', 'Thiruvananthapuram', 'Bhiwandi', 'Saharanpur',
  'Guntur', 'Amravati', 'Bikaner', 'Noida', 'Jamshedpur', 'Bhilai', 'Cuttack',
  'Firozabad', 'Kochi', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol', 'Nanded',
  'Kolhapur', 'Ajmer', 'Gulbarga', 'Kalaburagi', 'Jamnagar', 'Ujjain', 'Loni',
  'Siliguri', 'Jhansi', 'Ulhasnagar', 'Nellore', 'Jammu', 'Sangli-Miraj-Kupwad',
  'Belagavi', 'Mangaluru', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon',
  'Udaipur', 'Maheshtala', 'Davanagere', 'Kozhikode', 'Kurnool', 'Rajpur Sonarpur',
  'Rourkela', 'Bokaro', 'South Dumdum', 'Bellary', 'Ballari', 'Patiala', 'Gopalpur',
  'Agartala', 'Bhagalpur', 'Muzaffarnagar', 'Bhatpara', 'Panihati', 'Latur', 'Dhule',
  'Tiruppur', 'Rohtak', 'Korba', 'Bhilwara', 'Berhampur', 'Muzaffarpur', 'Ahmednagar',
  'Mathura', 'Kollam', 'Avadi', 'Kadapa', 'Kamarhati', 'Sambalpur', 'Bilaspur',
  'Shahjahanpur', 'Satara', 'Bijapur', 'Vijayapura', 'Rampur', 'Shivamogga', 'Chandrapur',
  'Junagadh', 'Thrissur', 'Alwar', 'Bardhaman', 'Kulti', 'Kakinada', 'Nizamabad',
  'Parbhani', 'Tumakuru', 'Khammam', 'Ozhukarai', 'Bihar Sharif', 'Panipat', 'Darbhanga',
  'Bally', 'Aizawl', 'Dewas', 'Ichalkaranji', 'Karnal', 'Bathinda', 'Jalna', 'Eluru',
  'Barasat', 'Kirari Suleman Nagar', 'Purnia', 'Satna', 'Mau', 'Sonipat', 'Farrukhabad',
  'Sagar', 'Rourkela', 'Durg', 'Imphal', 'Ratlam', 'Hapur', 'Arrah', 'Karimnagar',
  'Anantapur', 'Etawah', 'Ambernath', 'North Dumdum', 'Bharatpur', 'Begusarai', 'New Delhi',
  'Gandhinagar', 'Barmer', 'Mirzapur', 'Nagercoil', 'Pudukkottai', 'Hosur', 'Pondicherry',
  'Puducherry', 'Shillong', 'Itanagar', 'Gangtok', 'Panaji', 'Dispur', 'Kohima',
  'Port Blair', 'Silvassa', 'Daman', 'Diu', 'Kavaratti',

  // Popular Tourist Cities & Hill Stations
  'Ooty', 'Udhagamandalam', 'Shimla', 'Manali', 'Rishikesh', 'Haridwar', 'Munnar',
  'Darjeeling', 'Mussoorie', 'Nainital', 'Kodaikanal', 'Coorg', 'Madikeri', 'Chikmagalur',
  'Alleppey', 'Alappuzha', 'Varkala', 'Kovalam', 'Wayanad', 'Thekkady', 'Kumarakom',
  'Vagamon', 'Hampi', 'Gokarna', 'Dharamsala', 'McLeod Ganj', 'Dalhousie', 'Kasol',
  'Kullu', 'Solan', 'Kasauli', 'Spiti', 'Leh', 'Kargil', 'Gulmarg', 'Pahalgam',
  'Sonamarg', 'Mount Abu', 'Jaisalmer', 'Pushkar', 'Chittorgarh', 'Sawai Madhopur',
  'Ranthambore', 'Khajuraho', 'Pachmarhi', 'Orchha', 'Sanchi', 'Bodh Gaya', 'Rajgir',
  'Nalanda', 'Vaishali', 'Digha', 'Mandarmani', 'Kalimpong', 'Kurseong', 'Mirik',
  'Pelling', 'Ravangla', 'Lachung', 'Lachen', 'Yuksom', 'Tawang', 'Ziro', 'Bomdila',
  'Cherrapunji', 'Sohra', 'Dawki', 'Mawlynnong', 'Kaziranga', 'Majuli', 'Haflong',
  'Lonavala', 'Khandala', 'Mahabaleshwar', 'Matheran', 'Igatpuri', 'Alibaug', 'Lavasa',
  'Ratnagiri', 'Sawantwadi', 'Malvan', 'Panchgani', 'Tirupati', 'Srisailam', 'Araku Valley',
  'Horsley Hills', 'Lepakshi', 'Mantralayam', 'Lambasingi', 'Kanchipuram', 'Thanjavur',
  'Tiruvannamalai', 'Kumbakonam', 'Rameswaram', 'Rameshwaram', 'Kanyakumari', 'Yercaud',
  'Yelagiri', 'Valparai', 'Mahabalipuram', 'Mamallapuram', 'Courtallam', 'Velankanni',
  'Chidambaram', 'Chettinad', 'Pollachi', 'Hogenakkal', 'Sirsi', 'Murudeshwar', 'Badami',
  'Pattadakal', 'Belur', 'Halebidu', 'Dandeli', 'Sakleshpur', 'Kukke Subramanya', 'Dharmasthala',
  'Kollur', 'Sringeri', 'Bandipur', 'Nagarhole', 'Kabini', 'Agra', 'Mathura', 'Vrindavan',
  'Ayodhya', 'Chitrakoot', 'Kushinagar', 'Sarnath', 'Dudhwa', 'Hastinapur', 'Vindhyachal',
  'Bithoor', 'Orchha', 'Mandu', 'Bhedaghat', 'Shivpuri', 'Chhatarpur', 'Bandhavgarh',
  'Kanha', 'Pench', 'Tadoba', 'Gir', 'Somnath', 'Dwarka', 'Champaner', 'Saputara',
  'Mandvi', 'Palanpur', 'Diu', 'Daman', 'Silvassa', 'Calangute', 'Candolim', 'Baga',
  'Anjuna', 'Vagator', 'Arambol', 'Morjim', 'Colva', 'Benaulim', 'Palolem', 'Agonda',
  'Old Goa', 'Ponda', 'Margao', 'Vasco da Gama', 'Mapusa', 'Havelock Island', 'Neil Island',
  'Diglipur', 'Mayabunder', 'Baratang', 'Rangat',

  // Andhra Pradesh & Telangana
  'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Kakinada', 'Rajahmundry',
  'Rajamahendravaram', 'Tirupati', 'Kadapa', 'Anantapur', 'Vizianagaram', 'Eluru', 'Nandyal',
  'Ongole', 'Adoni', 'Machilipatnam', 'Tenali', 'Proddatur', 'Chittoor', 'Hindupur',
  'Bhimavaram', 'Madanapalle', 'Guntakal', 'Srikakulam', 'Dharmavaram', 'Gudivada',
  'Narasaraopet', 'Tadepalligudem', 'Tadpatri', 'Chilakaluripet', 'Amaravati', 'Srisailam',
  'Tanuku', 'Amalapuram', 'Palakollu', 'Kavali', 'Markapur', 'Kandukur', 'Rayachoti',
  'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam', 'Mahbubnagar', 'Nalgonda',
  'Adilabad', 'Suryapet', 'Siddipet', 'Miryalaguda', 'Jagtial', 'Nirmal', 'Kamareddy',
  'Kothagudem', 'Mancherial', 'Wanaparthy', 'Bhadrachalam', 'Yadagirigutta', 'Medak',
  'Sangareddy', 'Vikarabad', 'Gadwal', 'Wanaparthy', 'Bodhan', 'Siricilla', 'Bellampalle',

  // Tamil Nadu & Puducherry
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode',
  'Tirunelveli', 'Vellore', 'Thoothukudi', 'Nagercoil', 'Thanjavur', 'Dindigul',
  'Kanchipuram', 'Cuddalore', 'Tiruvannamalai', 'Kumbakonam', 'Karaikudi', 'Hosur',
  'Ambur', 'Rajapalayam', 'Pudukkottai', 'Nagapattinam', 'Paramakudi', 'Tiruchengodu',
  'Vaniyambadi', 'Theni', 'Allinagaram', 'Arani', 'Karaikal', 'Puducherry', 'Pondicherry',
  'Mahe', 'Yanam', 'Arakkonam', 'Virudhunagar', 'Srivilliputhur', 'Tindivanam', 'Mettupalayam',
  'Sivakasi', 'Valparai', 'Gobi', 'Gobichettipalayam', 'Attur', 'Dharapuram', 'Neyveli',
  'Mannargudi', 'Mayiladuthurai', 'Perambalur', 'Namakkal', 'Tirupathur', 'Ranipet',

  // Kerala
  'Thiruvananthapuram', 'Kochi', 'Cochin', 'Kozhikode', 'Calicut', 'Thrissur', 'Kollam',
  'Palakkad', 'Alappuzha', 'Alleppey', 'Kannur', 'Kottayam', 'Manjeri', 'Thalassery',
  'Ponnani', 'Vatakara', 'Kanhangad', 'Payyanur', 'Tirur', 'Cherthala', 'Kayamkulam',
  'Chittur', 'Muvattupuzha', 'Kothamangalam', 'Attingal', 'Kasaragod', 'Pathanamthitta',
  'Idukki', 'Thodupuzha', 'Chalakkudy', 'Kodungallur', 'Perumbavoor', 'Neyyattinkara',

  // Karnataka
  'Bengaluru', 'Bangalore', 'Mysore', 'Mysuru', 'Hubballi', 'Hubli', 'Dharwad', 'Mangaluru',
  'Mangalore', 'Belagavi', 'Belgaum', 'Davanagere', 'Ballari', 'Bellary', 'Vijayapura',
  'Bijapur', 'Shivamogga', 'Shimoga', 'Tumakuru', 'Tumkur', 'Raichur', 'Bidar', 'Hosapete',
  'Gadag', 'Udupi', 'Robertsonpet', 'Hassan', 'Bhadravati', 'Chitradurga', 'Kolar',
  'Mandya', 'Chikmagalur', 'Gangavati', 'Bagalkote', 'Ranebennur', 'Sirsi', 'Chikkaballapur',
  'Ramanagara', 'Karwar', 'Chintamani', 'Gokak', 'Yadgir', 'Koppal', 'Haveri', 'Nanjangud',

  // Maharashtra
  'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Pimpri-Chinchwad', 'Nashik', 'Kalyan-Dombivli',
  'Vasai-Virar', 'Aurangabad', 'Chhatrapati Sambhajinagar', 'Navi Mumbai', 'Solapur',
  'Mira-Bhayandar', 'Bhiwandi', 'Amravati', 'Nanded', 'Kolhapur', 'Ulhasnagar', 'Sangli',
  'Malegaon', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani',
  'Ichalkaranji', 'Jalna', 'Ambarnath', 'Bhusawal', 'Panvel', 'Badlapur', 'Beed', 'Gondia',
  'Satara', 'Yavatmal', 'Achalpur', 'Osmanabad', 'Dharashiv', 'Nandurbar', 'Wardha', 'Udgir',
  'Hinganghat', 'Gadchiroli', 'Washim', 'Palghar', 'Baramati', 'Pandharpur', 'Buldhana',
  'Bhandara', 'Ratnagiri', 'Sindhudurg', 'Karad', 'Kopargaon', 'Sangamner', 'Phaltan',

  // Gujarat
  'Ahmedabad', 'Surat', 'Vadodara', 'Baroda', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh',
  'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Bharuch', 'Mehsana', 'Bhuj',
  'Porbandar', 'Veraval', 'Valsad', 'Vapi', 'Palanpur', 'Patan', 'Botad', 'Amreli',
  'Deesa', 'Jetpur', 'Godhra', 'Dahod', 'Gondal', 'Ankleshwar', 'Surendranagar', 'Gandhidham',
  'Bardoli', 'Modasa', 'Keshod', 'Wadhwan', 'Himmatnagar', 'Dhoraji', 'Vyara', 'Sanand',

  // Rajasthan
  'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar',
  'Bharatpur', 'Sikar', 'Pali', 'Chittorgarh', 'Tonk', 'Kishangarh', 'Beawar', 'Jhunjhunu',
  'Sawai Madhopur', 'Nagaur', 'Churu', 'Dungarpur', 'Banswara', 'Sirohi', 'Barmer', 'Jalore',
  'Rajsamand', 'Nathdwara', 'Jhalawar', 'Baran', 'Bundi', 'Dholpur', 'Karauli', 'Pratapgarh',
  'Hanumangarh', 'Sri Ganganagar', 'Sujangarh', 'Hindaun', 'Gangapur City', 'Makrana',

  // Uttar Pradesh & Uttarakhand
  'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly',
  'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Greater Noida', 'Firozabad',
  'Jhansi', 'Muzaffarnagar', 'Mathura', 'Budaun', 'Rampur', 'Shahjahanpur', 'Farrukhabad',
  'Ayodhya', 'Faizabad', 'Mau', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal',
  'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Modinagar',
  'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda', 'Pilibhit', 'Barabanki', 'Khurja',
  'Gonda', 'Mainpuri', 'Lalitpur', 'Dehradun', 'Haridwar', 'Rishikesh', 'Nainital',
  'Haldwani', 'Roorkee', 'Kashipur', 'Rudrapur', 'Almora', 'Pithoragarh', 'Uttarkashi',
  'Kotdwar', 'Mussoorie', 'Ramnagar', 'Ranikhet', 'Bageshwar', 'Champawat', 'Rudraprayag',

  // Madhya Pradesh & Chhattisgarh
  'Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Dewas', 'Satna',
  'Ratlam', 'Rewa', 'Murwara', 'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind',
  'Chhatarpur', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur', 'Narmadapuram',
  'Hoshangabad', 'Itarsi', 'Sehore', 'Vidisha', 'Betul', 'Seoni', 'Datia', 'Nagda',
  'Shivpuri', 'Guna', 'Chhindwara', 'Balaghat', 'Mandla', 'Tikamgarh', 'Shahdol',
  'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Jagdalpur', 'Raigarh',
  'Ambikapur', 'Dhamtari', 'Mahasamund', 'Durg', 'Champa', 'Kanker', 'Kawardha', 'Janjgir',

  // West Bengal, Odisha & Jharkhand
  'Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda', 'Baharampur',
  'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj',
  'Jalpaiguri', 'Balurghat', 'Krishnanagar', 'Nabadwip', 'Midnapore', 'Bankura', 'Purulia',
  'Cooch Behar', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri',
  'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Bargarh', 'Rayagada',
  'Jatani', 'Kendujhar', 'Bolangir', 'Koraput', 'Paradeep', 'Dhenkanal', 'Barbil', 'Ranchi',
  'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Giridih', 'Ramgarh', 'Medininagar',
  'Daltonganj', 'Chaibasa', 'Dumka', 'Sahibganj', 'Gumla', 'Simdega', 'Khunti', 'Koderma',

  // Punjab, Haryana, Himachal & J&K
  'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Pathankot', 'Mohali',
  'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Khanna', 'Phagwara', 'Muktsar',
  'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Sunam', 'Gurgaon', 'Gurugram', 'Faridabad',
  'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula',
  'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jhajjar', 'Rewari', 'Kaithal', 'Palwal', 'Jagadhri',
  'Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Nahan', 'Bilaspur', 'Hamirpur', 'Una',
  'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Kathua', 'Sopore', 'Rajouri',
  'Punch', 'Kupra', 'Katra', 'Leh', 'Kargil',

  // Bihar
  'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif',
  'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chhapra', 'Danapur', 'Bettiah', 'Saharsa',
  'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bagaha', 'Buxar',
  'Kishanganj', 'Sitamarhi', 'Jamalpur', 'Jehanabad', 'Aurangabad', 'Lakhisarai', 'Samastipur',

  // North-East States
  'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon',
  'Dhubri', 'Diphu', 'North Lakhimpur', 'Karimganj', 'Goalpara', 'Sivasagar', 'Golaghat',
  'Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Williamnagar', 'Aizawl', 'Lunglei', 'Saiha',
  'Champhai', 'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto',
  'Imphal', 'Churachandpur', 'Thoubal', 'Bishnupur', 'Ukhrul', 'Gangtok', 'Namchi', 'Geyzing',
  'Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Itanagar', 'Naharlagun', 'Pasighat',
  'Tawang', 'Ziro', 'Bomdila', 'Tezu'
];

// Helper to remove duplicates while keeping case intact
const citySet = new Set<string>();
export const ALL_INDIAN_CITIES = INDIAN_CITIES.filter(city => {
  const normalized = city.trim();
  const lower = normalized.toLowerCase();
  if (citySet.has(lower)) return false;
  citySet.add(lower);
  return true;
});
