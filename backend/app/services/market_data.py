from typing import List, Dict, Any, Optional
import datetime
import numpy as np
import pandas as pd

# =====================================================================
# COMPLETE OFFICIAL NSE F&O MASTER UNIVERSE (~185 ACTIVE LIQUID STOCKS)
# =====================================================================
NSE_FNO_UNIVERSE = [
    # Top Heavyweights & Nifty 50
    {"symbol": "RELIANCE",   "sector": "Energy",       "basePrice": 1295.0,  "lotSize": 500,  "token": "2885"},
    {"symbol": "HDFCBANK",   "sector": "Banking",      "basePrice": 1745.0,  "lotSize": 550,  "token": "1333"},
    {"symbol": "ICICIBANK",  "sector": "Banking",      "basePrice": 1280.0,  "lotSize": 700,  "token": "4963"},
    {"symbol": "SBIN",       "sector": "PSU Bank",     "basePrice": 842.0,   "lotSize": 750,  "token": "3045"},
    {"symbol": "INFY",       "sector": "IT",           "basePrice": 1865.0,  "lotSize": 400,  "token": "1594"},
    {"symbol": "TCS",        "sector": "IT",           "basePrice": 4120.0,  "lotSize": 175,  "token": "11536"},
    {"symbol": "TATAMOTORS", "sector": "Auto",         "basePrice": 925.0,   "lotSize": 550,  "token": "3456"},
    {"symbol": "TATASTEEL",  "sector": "Metals",       "basePrice": 158.0,   "lotSize": 5500, "token": "3499"},
    {"symbol": "BAJFINANCE", "sector": "NBFC",         "basePrice": 7180.0,  "lotSize": 125,  "token": "317"},
    {"symbol": "HAL",        "sector": "Defence",      "basePrice": 4460.0,  "lotSize": 150,  "token": "2303"},
    {"symbol": "BEL",        "sector": "Defence",      "basePrice": 304.0,   "lotSize": 2850, "token": "383"},
    {"symbol": "LT",         "sector": "Infra",        "basePrice": 3640.0,  "lotSize": 150,  "token": "11483"},
    {"symbol": "AXISBANK",   "sector": "Banking",      "basePrice": 1185.0,  "lotSize": 625,  "token": "5900"},
    {"symbol": "KOTAKBANK",  "sector": "Banking",      "basePrice": 1790.0,  "lotSize": 400,  "token": "1922"},
    {"symbol": "BHARTIARTL", "sector": "Telecom",      "basePrice": 1645.0,  "lotSize": 475,  "token": "10604"},
    {"symbol": "M&M",        "sector": "Auto",         "basePrice": 2980.0,  "lotSize": 350,  "token": "2031"},
    {"symbol": "MARUTI",     "sector": "Auto",         "basePrice": 12150.0, "lotSize": 50,   "token": "10999"},
    {"symbol": "SUNPHARMA",  "sector": "Pharma",       "basePrice": 1840.0,  "lotSize": 350,  "token": "3351"},
    {"symbol": "ITC",        "sector": "FMCG",         "basePrice": 488.0,   "lotSize": 1600, "token": "1660"},
    {"symbol": "ADANIENT",   "sector": "Conglomerate", "basePrice": 2890.0,  "lotSize": 300,  "token": "25"},
    {"symbol": "ADANIPORTS", "sector": "Ports",        "basePrice": 1340.0,  "lotSize": 400,  "token": "15083"},
    {"symbol": "NTPC",       "sector": "Power",        "basePrice": 412.0,   "lotSize": 1500, "token": "11630"},
    {"symbol": "POWERGRID",  "sector": "Power",        "basePrice": 332.0,   "lotSize": 1800, "token": "14977"},
    {"symbol": "JSWSTEEL",   "sector": "Metals",       "basePrice": 975.0,   "lotSize": 675,  "token": "11723"},
    {"symbol": "HINDALCO",   "sector": "Metals",       "basePrice": 688.0,   "lotSize": 1400, "token": "1363"},
    {"symbol": "ONGC",       "sector": "Energy",       "basePrice": 274.0,   "lotSize": 1925, "token": "2475"},
    {"symbol": "TRENT",      "sector": "Retail",       "basePrice": 6850.0,  "lotSize": 100,  "token": "1964"},
    {"symbol": "WIPRO",      "sector": "IT",           "basePrice": 545.0,   "lotSize": 1500, "token": "3787"},
    
    # Banking & Financial Services
    {"symbol": "INDUSINDBK", "sector": "Banking",      "basePrice": 1430.0,  "lotSize": 500,  "token": "5258"},
    {"symbol": "BANKBARODA", "sector": "PSU Bank",     "basePrice": 255.0,   "lotSize": 2925, "token": "4668"},
    {"symbol": "PNB",        "sector": "PSU Bank",     "basePrice": 115.0,   "lotSize": 6000, "token": "10666"},
    {"symbol": "CANBK",      "sector": "PSU Bank",     "basePrice": 108.0,   "lotSize": 6750, "token": "10794"},
    {"symbol": "FEDERALBNK", "sector": "Banking",      "basePrice": 198.0,   "lotSize": 5000, "token": "1023"},
    {"symbol": "IDFCFIRSTB", "sector": "Banking",      "basePrice": 72.0,    "lotSize": 7500, "token": "11184"},
    {"symbol": "BANDHANBNK", "sector": "Banking",      "basePrice": 182.0,   "lotSize": 2500, "token": "2263"},
    {"symbol": "AUBANK",     "sector": "Banking",      "basePrice": 645.0,   "lotSize": 1000, "token": "21238"},
    {"symbol": "RBLBANK",    "sector": "Banking",      "basePrice": 210.0,   "lotSize": 2500, "token": "18391"},
    {"symbol": "BAJAJFINSV", "sector": "NBFC",         "basePrice": 1820.0,  "lotSize": 500,  "token": "16675"},
    {"symbol": "CHOLAFIN",   "sector": "NBFC",         "basePrice": 1420.0,  "lotSize": 625,  "token": "685"},
    {"symbol": "SHRIRAMFIN", "sector": "NBFC",         "basePrice": 3150.0,  "lotSize": 150,  "token": "4306"},
    {"symbol": "MUTHOOTFIN", "sector": "NBFC",         "basePrice": 1950.0,  "lotSize": 275,  "token": "23650"},
    {"symbol": "MANAPPURAM", "sector": "NBFC",         "basePrice": 185.0,   "lotSize": 3000, "token": "19084"},
    {"symbol": "M&MFIN",     "sector": "NBFC",         "basePrice": 312.0,   "lotSize": 2000, "token": "13285"},
    {"symbol": "RECLTD",     "sector": "NBFC",         "basePrice": 535.0,   "lotSize": 1000, "token": "15355"},
    {"symbol": "PFC",        "sector": "NBFC",         "basePrice": 485.0,   "lotSize": 1300, "token": "14299"},
    {"symbol": "LICHSGFIN",  "sector": "NBFC",         "basePrice": 680.0,   "lotSize": 1000, "token": "1997"},
    {"symbol": "POONAWALLA", "sector": "NBFC",         "basePrice": 420.0,   "lotSize": 1100, "token": "14681"},
    {"symbol": "SBICARD",    "sector": "Financial",    "basePrice": 715.0,   "lotSize": 800,  "token": "17971"},
    {"symbol": "SBILIFE",    "sector": "Insurance",    "basePrice": 1780.0,  "lotSize": 375,  "token": "21808"},
    {"symbol": "HDFCLIFE",   "sector": "Insurance",    "basePrice": 725.0,   "lotSize": 1100, "token": "467"},
    {"symbol": "ICICIPRULI", "sector": "Insurance",    "basePrice": 690.0,   "lotSize": 900,  "token": "18652"},
    {"symbol": "ICICIGI",    "sector": "Insurance",    "basePrice": 2050.0,  "lotSize": 250,  "token": "21770"},
    {"symbol": "HDFCAMC",    "sector": "Financial",    "basePrice": 4350.0,  "lotSize": 150,  "token": "4244"},
    {"symbol": "BSE",        "sector": "Financial",    "basePrice": 4650.0,  "lotSize": 150,  "token": "19585"},
    {"symbol": "CDSL",       "sector": "Financial",    "basePrice": 1680.0,  "lotSize": 375,  "token": "21174"},
    {"symbol": "MCX",        "sector": "Financial",    "basePrice": 6150.0,  "lotSize": 100,  "token": "31181"},
    {"symbol": "IEX",        "sector": "Financial",    "basePrice": 182.0,   "lotSize": 3750, "token": "220"},
    {"symbol": "ANGELONE",   "sector": "Financial",    "basePrice": 2980.0,  "lotSize": 250,  "token": "11195"},

    # IT & Technology
    {"symbol": "HCLTECH",    "sector": "IT",           "basePrice": 1840.0,  "lotSize": 350,  "token": "7229"},
    {"symbol": "TECHM",      "sector": "IT",           "basePrice": 1690.0,  "lotSize": 600,  "token": "13538"},
    {"symbol": "LTIM",       "sector": "IT",           "basePrice": 6120.0,  "lotSize": 150,  "token": "17818"},
    {"symbol": "PERSISTENT", "sector": "IT",           "basePrice": 5680.0,  "lotSize": 100,  "token": "18365"},
    {"symbol": "COFORGE",    "sector": "IT",           "basePrice": 7950.0,  "lotSize": 100,  "token": "11543"},
    {"symbol": "LTTS",       "sector": "IT",           "basePrice": 5520.0,  "lotSize": 100,  "token": "18564"},
    {"symbol": "OFSS",       "sector": "IT",           "basePrice": 11800.0, "lotSize": 50,   "token": "10738"},
    {"symbol": "NAUKRI",     "sector": "IT",           "basePrice": 7850.0,  "lotSize": 100,  "token": "13751"},
    {"symbol": "MPHASIS",    "sector": "IT",           "basePrice": 2980.0,  "lotSize": 275,  "token": "4503"},

    # Auto & Mobility
    {"symbol": "BAJAJ-AUTO", "sector": "Auto",         "basePrice": 9850.0,  "lotSize": 75,   "token": "16669"},
    {"symbol": "EICHERMOT",  "sector": "Auto",         "basePrice": 4850.0,  "lotSize": 150,  "token": "910"},
    {"symbol": "HEROMOTOCO", "sector": "Auto",         "basePrice": 5120.0,  "lotSize": 150,  "token": "1348"},
    {"symbol": "TVSMOTOR",   "sector": "Auto",         "basePrice": 2450.0,  "lotSize": 350,  "token": "8479"},
    {"symbol": "BHARATFORG", "sector": "Auto",         "basePrice": 1420.0,  "lotSize": 500,  "token": "422"},
    {"symbol": "MOTHERSON",  "sector": "Auto",         "basePrice": 178.0,   "lotSize": 3150, "token": "4204"},
    {"symbol": "BOSCHLTD",   "sector": "Auto",         "basePrice": 34800.0, "lotSize": 25,   "token": "2181"},
    {"symbol": "BALKRISIND", "sector": "Auto",         "basePrice": 2940.0,  "lotSize": 300,  "token": "335"},
    {"symbol": "MRF",        "sector": "Auto",         "basePrice": 128000.0,"lotSize": 5,    "token": "2277"},
    {"symbol": "APOLLOTYRE", "sector": "Auto",         "basePrice": 515.0,   "lotSize": 1700, "token": "163"},
    {"symbol": "EXIDEIND",   "sector": "Auto",         "basePrice": 465.0,   "lotSize": 1200, "token": "676"},

    # Metals & Mining
    {"symbol": "JINDALSTEL", "sector": "Metals",       "basePrice": 985.0,   "lotSize": 625,  "token": "6733"},
    {"symbol": "VEDL",       "sector": "Metals",       "basePrice": 480.0,   "lotSize": 1400, "token": "3063"},
    {"symbol": "COALINDIA",  "sector": "Metals",       "basePrice": 435.0,   "lotSize": 2100, "token": "20374"},
    {"symbol": "NMDC",       "sector": "Metals",       "basePrice": 235.0,   "lotSize": 4500, "token": "15332"},
    {"symbol": "SAIL",       "sector": "Metals",       "basePrice": 128.0,   "lotSize": 4000, "token": "2963"},
    {"symbol": "NATIONALUM", "sector": "Metals",       "basePrice": 238.0,   "lotSize": 3750, "token": "6364"},
    {"symbol": "HINDZINC",   "sector": "Metals",       "basePrice": 515.0,   "lotSize": 1000, "token": "1406"},

    # Energy, Oil & Gas
    {"symbol": "IOC",        "sector": "Energy",       "basePrice": 152.0,   "lotSize": 4875, "token": "1624"},
    {"symbol": "BPCL",       "sector": "Energy",       "basePrice": 315.0,   "lotSize": 1800, "token": "526"},
    {"symbol": "HINDPETRO",  "sector": "Energy",       "basePrice": 385.0,   "lotSize": 1350, "token": "1406"},
    {"symbol": "GAIL",       "sector": "Energy",       "basePrice": 212.0,   "lotSize": 2650, "token": "4717"},
    {"symbol": "PETRONET",   "sector": "Energy",       "basePrice": 348.0,   "lotSize": 1800, "token": "11351"},
    {"symbol": "IGL",        "sector": "Energy",       "basePrice": 415.0,   "lotSize": 1375, "token": "11260"},
    {"symbol": "MGL",        "sector": "Energy",       "basePrice": 1680.0,  "lotSize": 400,  "token": "17534"},
    {"symbol": "GUJGASLTD",  "sector": "Energy",       "basePrice": 545.0,   "lotSize": 1250, "token": "10599"},
    {"symbol": "OIL",        "sector": "Energy",       "basePrice": 510.0,   "lotSize": 1400, "token": "17963"},

    # Power & Utilities
    {"symbol": "TATAPOWER",  "sector": "Power",        "basePrice": 425.0,   "lotSize": 1350, "token": "3426"},
    {"symbol": "ADANIGREEN", "sector": "Power",        "basePrice": 1650.0,  "lotSize": 300,  "token": "3563"},
    {"symbol": "ADANIPOWER", "sector": "Power",        "basePrice": 610.0,   "lotSize": 875,  "token": "17388"},
    {"symbol": "JSWENERGY",  "sector": "Power",        "basePrice": 725.0,   "lotSize": 750,  "token": "17875"},
    {"symbol": "NHPC",       "sector": "Power",        "basePrice": 88.0,    "lotSize": 5500, "token": "17465"},
    {"symbol": "TORNTPOWER", "sector": "Power",        "basePrice": 1720.0,  "lotSize": 375,  "token": "13786"},
    {"symbol": "SJVN",       "sector": "Power",        "basePrice": 118.0,   "lotSize": 4500, "token": "18042"},

    # Pharma & Healthcare
    {"symbol": "DRREDDY",    "sector": "Pharma",       "basePrice": 6650.0,  "lotSize": 125,  "token": "881"},
    {"symbol": "CIPLA",      "sector": "Pharma",       "basePrice": 1580.0,  "lotSize": 350,  "token": "694"},
    {"symbol": "DIVISLAB",   "sector": "Pharma",       "basePrice": 5850.0,  "lotSize": 100,  "token": "10940"},
    {"symbol": "APOLLOHOSP", "sector": "Healthcare",   "basePrice": 7150.0,  "lotSize": 125,  "token": "157"},
    {"symbol": "LUPIN",      "sector": "Pharma",       "basePrice": 2180.0,  "lotSize": 425,  "token": "10440"},
    {"symbol": "AUROPHARMA", "sector": "Pharma",       "basePrice": 1350.0,  "lotSize": 550,  "token": "275"},
    {"symbol": "TORNTPHARM", "sector": "Pharma",       "basePrice": 3280.0,  "lotSize": 250,  "token": "3518"},
    {"symbol": "ZYDUSLIFE",  "sector": "Pharma",       "basePrice": 1050.0,  "lotSize": 900,  "token": "4161"},
    {"symbol": "BIOCON",     "sector": "Pharma",       "basePrice": 348.0,   "lotSize": 2500, "token": "11373"},
    {"symbol": "GLENMARK",   "sector": "Pharma",       "basePrice": 1640.0,  "lotSize": 375,  "token": "7406"},
    {"symbol": "ALKEM",      "sector": "Pharma",       "basePrice": 5750.0,  "lotSize": 100,  "token": "11703"},
    {"symbol": "SYNGENE",    "sector": "Pharma",       "basePrice": 880.0,   "lotSize": 1000, "token": "10243"},
    {"symbol": "MAXHEALTH",  "sector": "Healthcare",   "basePrice": 995.0,   "lotSize": 550,  "token": "2142"},
    {"symbol": "LAURUSLABS", "sector": "Pharma",       "basePrice": 465.0,   "lotSize": 1100, "token": "19234"},
    {"symbol": "GRANULES",   "sector": "Pharma",       "basePrice": 560.0,   "lotSize": 1000, "token": "11872"},

    # FMCG & Consumer Goods
    {"symbol": "HINDUNILVR", "sector": "FMCG",         "basePrice": 2480.0,  "lotSize": 300,  "token": "1394"},
    {"symbol": "NESTLEIND",  "sector": "FMCG",         "basePrice": 2350.0,  "lotSize": 250,  "token": "17963"},
    {"symbol": "BRITANNIA",  "sector": "FMCG",         "basePrice": 5150.0,  "lotSize": 125,  "token": "547"},
    {"symbol": "TATACONSUM", "sector": "FMCG",         "basePrice": 985.0,   "lotSize": 900,  "token": "3432"},
    {"symbol": "DABUR",      "sector": "FMCG",         "basePrice": 525.0,   "lotSize": 1250, "token": "772"},
    {"symbol": "MARICO",     "sector": "FMCG",         "basePrice": 645.0,   "lotSize": 1200, "token": "4067"},
    {"symbol": "GODREJCP",   "sector": "FMCG",         "basePrice": 1220.0,  "lotSize": 500,  "token": "10099"},
    {"symbol": "COLPAL",     "sector": "FMCG",         "basePrice": 3120.0,  "lotSize": 200,  "token": "15141"},
    {"symbol": "VBL",        "sector": "FMCG",         "basePrice": 620.0,   "lotSize": 1000, "token": "18921"},
    {"symbol": "RADICO",     "sector": "FMCG",         "basePrice": 2240.0,  "lotSize": 300,  "token": "11400"},
    {"symbol": "UBL",        "sector": "FMCG",         "basePrice": 2040.0,  "lotSize": 350,  "token": "16713"},
    {"symbol": "MCDOWELL-N", "sector": "FMCG",         "basePrice": 1540.0,  "lotSize": 400,  "token": "10447"},

    # Capital Goods, Defence & Infra
    {"symbol": "BDL",        "sector": "Defence",      "basePrice": 1280.0,  "lotSize": 400,  "token": "21808"},
    {"symbol": "MAZDOCK",    "sector": "Defence",      "basePrice": 4650.0,  "lotSize": 100,  "token": "10931"},
    {"symbol": "COCHINSHIP", "sector": "Defence",      "basePrice": 1620.0,  "lotSize": 350,  "token": "21703"},
    {"symbol": "SIEMENS",    "sector": "Capital Goods","basePrice": 7450.0,  "lotSize": 75,   "token": "3150"},
    {"symbol": "ABB",        "sector": "Capital Goods","basePrice": 7850.0,  "lotSize": 125,  "token": "13"},
    {"symbol": "CUMMINSIND", "sector": "Capital Goods","basePrice": 3650.0,  "lotSize": 150,  "token": "1901"},
    {"symbol": "BHEL",       "sector": "Capital Goods","basePrice": 245.0,   "lotSize": 2625, "token": "438"},
    {"symbol": "POLYCAB",    "sector": "Capital Goods","basePrice": 6850.0,  "lotSize": 100,  "token": "9590"},
    {"symbol": "KEI",        "sector": "Capital Goods","basePrice": 4350.0,  "lotSize": 150,  "token": "13697"},
    {"symbol": "HAVELLS",    "sector": "Capital Goods","basePrice": 1780.0,  "lotSize": 500,  "token": "981"},
    {"symbol": "VOLTAS",     "sector": "Capital Goods","basePrice": 1720.0,  "lotSize": 350,  "token": "3718"},
    {"symbol": "DIXON",      "sector": "Capital Goods","basePrice": 15800.0, "lotSize": 50,   "token": "21690"},
    {"symbol": "ASTRAL",     "sector": "Building Mat", "basePrice": 1890.0,  "lotSize": 400,  "token": "14418"},
    {"symbol": "SUPREMEIND", "sector": "Building Mat", "basePrice": 4650.0,  "lotSize": 125,  "token": "3411"},

    # Chemicals & Fertilizers
    {"symbol": "PIDILITIND", "sector": "Chemicals",    "basePrice": 3120.0,  "lotSize": 250,  "token": "2664"},
    {"symbol": "SRF",        "sector": "Chemicals",    "basePrice": 2350.0,  "lotSize": 375,  "token": "3273"},
    {"symbol": "DEEPAKNTR",  "sector": "Chemicals",    "basePrice": 2850.0,  "lotSize": 300,  "token": "19943"},
    {"symbol": "TATACHEM",   "sector": "Chemicals",    "basePrice": 1080.0,  "lotSize": 550,  "token": "3405"},
    {"symbol": "PIIND",      "sector": "Chemicals",    "basePrice": 4450.0,  "lotSize": 150,  "token": "2412"},
    {"symbol": "UPL",        "sector": "Chemicals",    "basePrice": 560.0,   "lotSize": 1300, "token": "11287"},
    {"symbol": "COROMANDEL", "sector": "Chemicals",    "basePrice": 1680.0,  "lotSize": 350,  "token": "739"},
    {"symbol": "CHAMBLFERT", "sector": "Chemicals",    "basePrice": 520.0,   "lotSize": 1200, "token": "637"},
    {"symbol": "GNFC",       "sector": "Chemicals",    "basePrice": 690.0,   "lotSize": 1000, "token": "1198"},
    {"symbol": "NAVINFLUOR", "sector": "Chemicals",    "basePrice": 3350.0,  "lotSize": 175,  "token": "14672"},
    {"symbol": "ATUL",       "sector": "Chemicals",    "basePrice": 7650.0,  "lotSize": 75,   "token": "263"},

    # Cement & Real Estate
    {"symbol": "ULTRACEMCO", "sector": "Cement",       "basePrice": 11600.0, "lotSize": 50,   "token": "11532"},
    {"symbol": "AMBUJACEM",  "sector": "Cement",       "basePrice": 585.0,   "lotSize": 900,  "token": "1270"},
    {"symbol": "ACC",        "sector": "Cement",       "basePrice": 2320.0,  "lotSize": 300,  "token": "22"},
    {"symbol": "SHREECEM",   "sector": "Cement",       "basePrice": 25500.0, "lotSize": 25,   "token": "3103"},
    {"symbol": "DALBHARAT",  "sector": "Cement",       "basePrice": 1890.0,  "lotSize": 300,  "token": "8075"},
    {"symbol": "DLF",        "sector": "Realty",       "basePrice": 845.0,   "lotSize": 825,  "token": "14732"},
    {"symbol": "GODREJPROP", "sector": "Realty",       "basePrice": 2980.0,  "lotSize": 200,  "token": "17875"},
    {"symbol": "OBEROIRLTY", "sector": "Realty",       "basePrice": 1950.0,  "lotSize": 350,  "token": "20242"},
    {"symbol": "PHOENIXLTD", "sector": "Realty",       "basePrice": 1680.0,  "lotSize": 350,  "token": "20501"},
    {"symbol": "PRESTIGE",   "sector": "Realty",       "basePrice": 1750.0,  "lotSize": 350,  "token": "20299"},
    {"symbol": "BRIGADE",    "sector": "Realty",       "basePrice": 1280.0,  "lotSize": 450,  "token": "14562"},
    {"symbol": "GMRINFRA",   "sector": "Infra",        "basePrice": 88.0,    "lotSize": 5000, "token": "13528"},
    {"symbol": "IRCTC",      "sector": "Travel",       "basePrice": 875.0,   "lotSize": 625,  "token": "13611"},
    {"symbol": "CONCOR",     "sector": "Logistics",    "basePrice": 840.0,   "lotSize": 750,  "token": "4749"},

    # Telecom, Media & Retail
    {"symbol": "INDUSTOWER", "sector": "Telecom",      "basePrice": 385.0,   "lotSize": 1700, "token": "29135"},
    {"symbol": "IDEA",       "sector": "Telecom",      "basePrice": 9.5,     "lotSize": 40000,"token": "14366"},
    {"symbol": "SUNTV",      "sector": "Media",        "basePrice": 780.0,   "lotSize": 750,  "token": "13404"},
    {"symbol": "ZEEL",       "sector": "Media",        "basePrice": 128.0,   "lotSize": 3000, "token": "3812"},
    {"symbol": "PVRINOX",    "sector": "Media",        "basePrice": 1520.0,  "lotSize": 400,  "token": "13197"},
    {"symbol": "TITAN",      "sector": "Retail",       "basePrice": 3450.0,  "lotSize": 175,  "token": "3506"},
    {"symbol": "ASIANPAINT", "sector": "Paints",       "basePrice": 2520.0,  "lotSize": 200,  "token": "236"},
    {"symbol": "BERGEPAINT", "sector": "Paints",       "basePrice": 485.0,   "lotSize": 1100, "token": "404"},

    # New-Age Tech
    {"symbol": "ZOMATO",     "sector": "New-Age Tech", "basePrice": 275.0,   "lotSize": 2100, "token": "5097"},
    {"symbol": "NYKAA",      "sector": "New-Age Tech", "basePrice": 182.0,   "lotSize": 3125, "token": "6545"},
    {"symbol": "PAYTM",      "sector": "New-Age Tech", "basePrice": 880.0,   "lotSize": 650,  "token": "7929"},
    {"symbol": "PBFINTECH",  "sector": "New-Age Tech", "basePrice": 1840.0,  "lotSize": 300,  "token": "7963"}
]

FNO_DICT = {item['symbol']: item for item in NSE_FNO_UNIVERSE}

class MarketDataProvider:
    """Provides historical and real-time intraday data for the complete NSE F&O universe."""

    def __init__(self):
        self.live_quotes: Dict[str, Dict[str, Any]] = {}
        self._candle_cache: Dict[str, pd.DataFrame] = {}
        self._init_mock_quotes()

    def _init_mock_quotes(self):
        for item in NSE_FNO_UNIVERSE:
            sym = item['symbol']
            base = item['basePrice']
            self.live_quotes[sym] = {
                "symbol": sym,
                "ltp": base,
                "open": base * 0.998,
                "high": base * 1.012,
                "low": base * 0.992,
                "close": base,
                "change": 0.0,
                "change_pct": 0.0,
                "volume": 250000,
                "last_update": datetime.datetime.now().isoformat()
            }

    def update_tick(self, symbol: str) -> Dict[str, Any]:
        """Simulates live tick movement with realistic brownian noise."""
        if symbol not in self.live_quotes:
            return {}
        quote = self.live_quotes[symbol]
        curr = quote['ltp']
        noise = float(np.random.normal(0, 0.001))
        new_ltp = round(curr * (1.0 + noise), 2)
        base = FNO_DICT[symbol]['basePrice']
        chg = round(new_ltp - base, 2)
        chg_pct = round((chg / base) * 100.0, 2)

        quote['ltp'] = new_ltp
        quote['high'] = max(quote['high'], new_ltp)
        quote['low'] = min(quote['low'], new_ltp)
        quote['change'] = chg
        quote['change_pct'] = chg_pct
        quote['volume'] += int(np.random.randint(50, 500))
        quote['last_update'] = datetime.datetime.now().isoformat()
        return quote

    def get_5m_candles(self, symbol: str, days: int = 5) -> pd.DataFrame:
        """
        Fetches 5-minute candles. Caches result in memory for ultra-fast response.
        """
        cache_key = f"{symbol}_{days}"
        if cache_key in self._candle_cache:
            return self._candle_cache[cache_key].copy()

        base_item = FNO_DICT.get(symbol, {"basePrice": 1000.0, "lotSize": 100})
        base_price = base_item['basePrice']

        candles = []
        today = datetime.date.today()
        candles_per_day = 75

        for d in range(days - 1, -1, -1):
            day_date = today - datetime.timedelta(days=d)
            if day_date.weekday() >= 5:
                continue

            current_p = base_price * (1.0 + np.random.normal(0, 0.015))
            start_min = 9 * 60 + 15

            for c in range(candles_per_day):
                minute = start_min + c * 5
                hh = minute // 60
                mm = minute % 60
                time_str = f"{day_date.strftime('%Y-%m-%d')} {hh:02d}:{mm:02d}"

                drift = float(np.random.normal(0.0001, 0.002))
                c_open = current_p
                c_close = c_open * (1.0 + drift)
                c_high = max(c_open, c_close) * (1.0 + abs(float(np.random.normal(0, 0.0015))))
                c_low = min(c_open, c_close) * (1.0 - abs(float(np.random.normal(0, 0.0015))))
                vol = int(np.random.exponential(scale=15000) + 5000)

                candles.append({
                    "date": day_date.strftime('%Y-%m-%d'),
                    "time": time_str,
                    "open": round(c_open, 2),
                    "high": round(c_high, 2),
                    "low": round(c_low, 2),
                    "close": round(c_close, 2),
                    "volume": vol
                })
                current_p = c_close

        df = pd.DataFrame(candles)
        self._candle_cache[cache_key] = df
        return df.copy()

market_data = MarketDataProvider()
