/**
 * Indiana County Reference Data
 * 2020 Census Data with FIPS IDs
 * Shared between Economic Calculator and Impact Map
 */
window.IndianaCounties = [
    { id: "001", name: "Adams", pop: 35809 },
    { id: "003", name: "Allen", pop: 385410 },
    { id: "005", name: "Bartholomew", pop: 82208 },
    { id: "007", name: "Benton", pop: 8719 },
    { id: "009", name: "Blackford", pop: 12112 },
    { id: "011", name: "Boone", pop: 70812 },
    { id: "013", name: "Brown", pop: 15475 },
    { id: "015", name: "Carroll", pop: 20306 },
    { id: "017", name: "Cass", pop: 37870 },
    { id: "019", name: "Clark", pop: 121093 },
    { id: "021", name: "Clay", pop: 26466 },
    { id: "023", name: "Clinton", pop: 33190 },
    { id: "025", name: "Crawford", pop: 10526 },
    { id: "027", name: "Daviess", pop: 33381 },
    { id: "029", name: "Dearborn", pop: 50679 },
    { id: "031", name: "Decatur", pop: 26472 },
    { id: "033", name: "DeKalb", pop: 43265 },
    { id: "035", name: "Delaware", pop: 111903 },
    { id: "037", name: "Dubois", pop: 43637 },
    { id: "039", name: "Elkhart", pop: 207047 },
    { id: "041", name: "Fayette", pop: 23398 },
    { id: "043", name: "Floyd", pop: 80484 },
    { id: "045", name: "Fountain", pop: 16479 },
    { id: "047", name: "Franklin", pop: 22785 },
    { id: "049", name: "Fulton", pop: 20480 },
    { id: "051", name: "Gibson", pop: 33011 },
    { id: "053", name: "Grant", pop: 66674 },
    { id: "055", name: "Greene", pop: 30803 },
    { id: "057", name: "Hamilton", pop: 347467 },
    { id: "059", name: "Hancock", pop: 79840 },
    { id: "061", name: "Harrison", pop: 39654 },
    { id: "063", name: "Hendricks", pop: 174788 },
    { id: "065", name: "Henry", pop: 48914 },
    { id: "067", name: "Howard", pop: 82544 },
    { id: "069", name: "Huntington", pop: 36662 },
    { id: "071", name: "Jackson", pop: 46428 },
    { id: "073", name: "Jasper", pop: 32918 },
    { id: "075", name: "Jay", pop: 20478 },
    { id: "077", name: "Jefferson", pop: 33147 },
    { id: "079", name: "Jennings", pop: 27613 },
    { id: "081", name: "Johnson", pop: 161765 },
    { id: "083", name: "Knox", pop: 36282 },
    { id: "085", name: "Kosciusko", pop: 80240 },
    { id: "087", name: "LaGrange", pop: 40446 },
    { id: "089", name: "Lake", pop: 498700 },
    { id: "091", name: "LaPorte", pop: 112417 },
    { id: "093", name: "Lawrence", pop: 45011 },
    { id: "095", name: "Madison", pop: 130129 },
    { id: "097", name: "Marion", pop: 977203 },
    { id: "099", name: "Marshall", pop: 46095 },
    { id: "101", name: "Martin", pop: 9812 },
    { id: "103", name: "Miami", pop: 35962 },
    { id: "105", name: "Monroe", pop: 139718 },
    { id: "107", name: "Montgomery", pop: 37936 },
    { id: "109", name: "Morgan", pop: 71780 },
    { id: "111", name: "Newton", pop: 13830 },
    { id: "113", name: "Noble", pop: 47457 },
    { id: "115", name: "Ohio", pop: 5940 },
    { id: "117", name: "Orange", pop: 19867 },
    { id: "119", name: "Owen", pop: 21321 },
    { id: "121", name: "Parke", pop: 16156 },
    { id: "123", name: "Perry", pop: 19170 },
    { id: "125", name: "Pike", pop: 12250 },
    { id: "127", name: "Porter", pop: 173215 },
    { id: "129", name: "Posey", pop: 25222 },
    { id: "131", name: "Pulaski", pop: 12514 },
    { id: "133", name: "Putnam", pop: 36726 },
    { id: "135", name: "Randolph", pop: 24502 },
    { id: "137", name: "Ripley", pop: 28995 },
    { id: "139", name: "Rush", pop: 16752 },
    { id: "141", name: "St. Joseph", pop: 272912 },
    { id: "143", name: "Scott", pop: 24384 },
    { id: "145", name: "Shelby", pop: 45055 },
    { id: "147", name: "Spencer", pop: 19810 },
    { id: "149", name: "Starke", pop: 23371 },
    { id: "151", name: "Steuben", pop: 34435 },
    { id: "153", name: "Sullivan", pop: 20817 },
    { id: "155", name: "Switzerland", pop: 9737 },
    { id: "157", name: "Tippecanoe", pop: 186251 },
    { id: "159", name: "Tipton", pop: 15359 },
    { id: "161", name: "Union", pop: 7087 },
    { id: "163", name: "Vanderburgh", pop: 180136 },
    { id: "165", name: "Vermillion", pop: 15439 },
    { id: "167", name: "Vigo", pop: 106153 },
    { id: "169", name: "Wabash", pop: 30976 },
    { id: "171", name: "Warren", pop: 8440 },
    { id: "173", name: "Warrick", pop: 63898 },
    { id: "175", name: "Washington", pop: 28182 },
    { id: "177", name: "Wayne", pop: 66553 },
    { id: "179", name: "Wells", pop: 28180 },
    { id: "181", name: "White", pop: 24688 },
    { id: "183", name: "Whitley", pop: 34191 }
];

// Helper functions
window.IndianaCounties.findById = function (id)
{
    return this.find(c => c.id === id);
};

window.IndianaCounties.findByName = function (name)
{
    return this.find(c => c.name.toLowerCase() === name.toLowerCase());
};

window.IndianaCounties.findByPop = function (pop)
{
    return this.find(c => c.pop === parseInt(pop));
};
