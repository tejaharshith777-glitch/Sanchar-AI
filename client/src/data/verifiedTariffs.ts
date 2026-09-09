/**
 * Official Gazette Verified Transport Tariffs across Indian Metros
 * Used by City Spotlight, Fare Guardian, Chatbot, and Offline KB.
 */

export interface TariffDetails {
  city: string;
  vehicleType: 'auto' | 'taxi';
  minFare: number;
  minDistKm: number;
  perKm: number;
  nightSurchargePct: number;
  nightHours: string;
  nightDisabled?: boolean;
  nightNote?: string;
  officialCitation: string;
  notes?: string;
  isOfficial: boolean;
}

export const VERIFIED_TARIFFS: Record<string, { auto?: TariffDetails; taxi?: TariffDetails; generalNote?: string }> = {
  Mumbai: {
    // source: MMRTA Gazette Notification w.e.f 01/09/2026
    auto: {
      city: 'Mumbai',
      vehicleType: 'auto',
      minFare: 27,
      minDistKm: 1.5,
      perKm: 18.22,
      nightSurchargePct: 25,
      nightHours: '12:00 AM – 5:00 AM (+25%)',
      officialCitation: 'MMRTA Gazette Notification w.e.f 01/09/2026',
      notes: 'Meters recalibrating till 30/11/2026. Insist on electronic tariff card.',
      isOfficial: true
    },
    // source: MMRTA Gazette Notification w.e.f 01/09/2026
    taxi: {
      city: 'Mumbai',
      vehicleType: 'taxi',
      minFare: 33,
      minDistKm: 1.5,
      perKm: 21.90,
      nightSurchargePct: 25,
      nightHours: '12:00 AM – 5:00 AM (+25%)',
      officialCitation: 'MMRTA Gazette Notification w.e.f 01/09/2026',
      notes: 'Black-and-Yellow (Kali-Peeli) meter taxi.',
      isOfficial: true
    }
  },
  Chennai: {
    // source: Tamil Nadu Transport Dept Gazette Chart 2023
    auto: {
      city: 'Chennai',
      vehicleType: 'auto',
      minFare: 25,
      minDistKm: 1.8,
      perKm: 12.00,
      nightSurchargePct: 50,
      nightHours: '11:00 PM – 5:00 AM (+50%)',
      officialCitation: 'Tamil Nadu Transport Dept Gazette Chart 2023',
      notes: 'Insist on digital meter or official pre-paid counter.',
      isOfficial: true
    },
    taxi: {
      city: 'Chennai',
      vehicleType: 'taxi',
      minFare: 100,
      minDistKm: 4.0,
      perKm: 20.00,
      nightSurchargePct: 0,
      nightHours: 'No gazetted night rule',
      nightDisabled: true,
      nightNote: 'No gazetted night rule',
      officialCitation: 'Illustrative only, not a tariff',
      notes: 'Illustrative only, not a tariff. App fares dynamic — compare in-app',
      isOfficial: false
    }
  },
  Bengaluru: {
    // source: Bengaluru RTA Notification 14/07/2025 (eff. 01/08/2025)
    auto: {
      city: 'Bengaluru',
      vehicleType: 'auto',
      minFare: 36,
      minDistKm: 2.0,
      perKm: 18.00,
      nightSurchargePct: 50,
      nightHours: '10:00 PM – 5:00 AM (+50%)',
      officialCitation: 'Bengaluru RTA Notification 14/07/2025 (eff. 01/08/2025)',
      notes: 'First 2 km ₹36 minimum fare.',
      isOfficial: true
    },
    taxi: {
      city: 'Bengaluru',
      vehicleType: 'taxi',
      minFare: 100,
      minDistKm: 4.0,
      perKm: 24.00,
      nightSurchargePct: 0,
      nightHours: 'No gazetted night rule',
      nightDisabled: true,
      nightNote: 'No gazetted night rule',
      officialCitation: 'App-capped, indicative only',
      notes: 'App fares dynamic — compare in-app',
      isOfficial: false
    }
  },
  Delhi: {
    // source: Delhi Govt Transport Dept Notification 09/01/2023
    auto: {
      city: 'Delhi',
      vehicleType: 'auto',
      minFare: 30,
      minDistKm: 1.5,
      perKm: 11.00,
      nightSurchargePct: 25,
      nightHours: '11:00 PM – 5:00 AM (+25%)',
      officialCitation: 'Delhi Govt Transport Dept Notification 09/01/2023',
      notes: 'First 1.5 km ₹30 minimum fare.',
      isOfficial: true
    },
    // source: Delhi Govt Transport Dept Notification 09/01/2023
    taxi: {
      city: 'Delhi',
      vehicleType: 'taxi',
      minFare: 40,
      minDistKm: 1.0,
      perKm: 17.00,
      nightSurchargePct: 25,
      nightHours: '11:00 PM – 5:00 AM (+25%)',
      officialCitation: 'Delhi Govt Transport Dept Notification 09/01/2023',
      notes: 'Non-AC ₹17/km, AC ₹20/km after initial 1 km ₹40 base.',
      isOfficial: true
    }
  },
  Hyderabad: {
    // source: TG Transport Gazette 2014 Tariff
    auto: {
      city: 'Hyderabad',
      vehicleType: 'auto',
      minFare: 20,
      minDistKm: 1.6,
      perKm: 11.00,
      nightSurchargePct: 0,
      nightHours: 'Night rule pending',
      nightDisabled: true,
      nightNote: '1.5x night rule proposed 03/09/2026 is pending government approval.',
      officialCitation: 'TG Transport Gazette 2014 Tariff',
      notes: 'First 1.6 km ₹20 base fare.',
      isOfficial: true
    },
    taxi: {
      city: 'Hyderabad',
      vehicleType: 'taxi',
      minFare: 40,
      minDistKm: 2.0,
      perKm: 21.00,
      nightSurchargePct: 0,
      nightHours: 'No gazetted night rule',
      nightDisabled: true,
      nightNote: 'No gazetted night rule',
      officialCitation: 'Indicative reported rate',
      notes: 'Indicative rate based on pre-paid station counter tariffs.',
      isOfficial: false
    }
  },
  Kolkata: {
    auto: {
      city: 'Kolkata',
      vehicleType: 'auto',
      minFare: 15,
      minDistKm: 1.0,
      perKm: 0,
      nightSurchargePct: 0,
      nightHours: 'No gazetted night rule',
      nightDisabled: true,
      nightNote: 'No gazetted night rule',
      officialCitation: 'Reported per-seat range (unverified)',
      notes: 'route-wise fixed fares — ask before boarding',
      isOfficial: false
    },
    // source: WB Transport Dept Gazette Notification 2529-WT 11/06/2018
    taxi: {
      city: 'Kolkata',
      vehicleType: 'taxi',
      minFare: 30,
      minDistKm: 2.0,
      perKm: 15.00,
      nightSurchargePct: 0,
      nightHours: 'Night rule unverified',
      nightDisabled: true,
      nightNote: 'Night rule unverified — confirm on meter.',
      officialCitation: 'WB Transport Dept Gazette Notification 2529-WT 11/06/2018',
      notes: 'Yellow Taxi meter rate (apply meter multiplier if applicable).',
      isOfficial: true
    }
  }
};

export function calculateVerifiedFare(city: string, vehicleType: 'auto' | 'taxi', distanceKm: number, isNight: boolean = false) {
  const cityData = VERIFIED_TARIFFS[city];
  const tariff = cityData ? cityData[vehicleType] : null;

  if (!tariff) {
    // Rough all-India guess — insist on meter. Upper bound = +8% traffic buffer.
    const base = vehicleType === 'auto' ? 25 : 50;
    const perKm = vehicleType === 'auto' ? 14 : 20;
    const extraDist = Math.max(0, distanceKm - 1.5);
    const est = Math.round(base + extraDist * perKm);
    const nightMult = isNight ? 1.25 : 1.0;
    const min = Math.round(est * nightMult * 0.95);
    const max = Math.round(est * nightMult * 1.08); // +8% traffic buffer
    return {
      min,
      max,
      isOfficial: false,
      citation: 'Rough all-India guess — insist on meter',
      note: 'Insist on meter before boarding. Traffic buffer +8% included.'
    };
  }

  if (city === 'Kolkata' && vehicleType === 'auto') {
    return {
      min: 15,
      max: 25,
      isOfficial: false,
      citation: 'Reported per-seat range (unverified)',
      note: 'route-wise fixed fares — ask before boarding'
    };
  }

  const extraDist = Math.max(0, distanceKm - tariff.minDistKm);
  const baseFare = tariff.minFare + extraDist * tariff.perKm;
  const nightMult = (isNight && !tariff.nightDisabled) ? (1 + tariff.nightSurchargePct / 100) : 1.0;
  const min = Math.round(baseFare * nightMult);
  const max = Math.round(min * 1.08); // +8% traffic buffer

  return {
    min,
    max,
    isOfficial: tariff.isOfficial,
    citation: tariff.officialCitation,
    note: tariff.notes,
    tariff
  };
}
