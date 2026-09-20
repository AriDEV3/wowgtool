local addonName, addonTable = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:RegisterEvent("PLAYER_LOGIN") 
frame:RegisterEvent("PLAYER_LOGOUT")
frame:RegisterEvent("BANKFRAME_OPENED")
frame:RegisterEvent("BANKFRAME_CLOSED")
frame:RegisterEvent("PLAYERBANKSLOTS_CHANGED")
frame:RegisterEvent("ACCOUNT_MONEY")

local isBankOpen = false

-- Hilfsfunktion: Prüft, ob eine Taschen-ID zur Kriegsmeilen-Bank gehört
local function IsWarbandBagID(bagID)
    if C_Bank and C_Bank.FetchPurchasedBankTabIDs then
        local warbandTabIDs = C_Bank.FetchPurchasedBankTabIDs(Enum.BankType.Account)
        if warbandTabIDs then
            for _, id in ipairs(warbandTabIDs) do
                if id == bagID then return true end
            end
        end
    end
    return false
end

-- Taschen & Bank scannen mit Seelengebunden-Filter
local function ScanCharacterInventory()
    local bagsData = {}
    local bankData = {}
    local soulboundData = {}

    -- 1. SCHRITT: Taschen scannen (IDs 0 bis 4)
    for bag = 0, 4 do
        if C_Container and C_Container.GetContainerNumSlots then
            local slots = C_Container.GetContainerNumSlots(bag)
            for slot = 1, slots do
                local itemInfo = C_Container.GetContainerItemInfo(bag, slot)
                if itemInfo and itemInfo.itemID and itemInfo.stackCount then
                    local itemIDStr = tostring(itemInfo.itemID)
                    
                    if itemInfo.isBound then
                        soulboundData[itemIDStr] = (soulboundData[itemIDStr] or 0) + itemInfo.stackCount
                    else
                        bagsData[itemIDStr] = (bagsData[itemIDStr] or 0) + itemInfo.stackCount
                    end
                end
            end
        end
    end

    -- 2. SCHRITT: Bank scannen (IDs -1 und 6 bis 12) - Nur wenn die Bank offen ist!
    if isBankOpen then
        for bag = -1, 12 do
            local isBankBag = (bag == -1 or (bag >= 6 and bag <= 12))
            if isBankBag and not IsWarbandBagID(bag) then
                if C_Container and C_Container.GetContainerNumSlots then
                    local slots = C_Container.GetContainerNumSlots(bag)
                    for slot = 1, slots do
                        local itemInfo = C_Container.GetContainerItemInfo(bag, slot)
                        if itemInfo and itemInfo.itemID and itemInfo.stackCount then
                            local itemIDStr = tostring(itemInfo.itemID)
                            
                            if itemInfo.isBound then
                                soulboundData[itemIDStr] = (soulboundData[itemIDStr] or 0) + itemInfo.stackCount
                            else
                                bankData[itemIDStr] = (bankData[itemIDStr] or 0) + itemInfo.stackCount
                            end
                        end
                    end
                end
            end
        end
    end

    return bagsData, bankData, soulboundData
end

-- Reine Kriegsmeilen-Bank (Warband) scannen (Kriegsmeilen-Items können nicht seelengebunden sein)
local function ScanWarbandBankOnly()
    local data = {}
    if C_Bank and C_Bank.FetchPurchasedBankTabIDs then
        local warbandTabIDs = C_Bank.FetchPurchasedBankTabIDs(Enum.BankType.Account)
        if warbandTabIDs then
            for _, tabID in ipairs(warbandTabIDs) do
                local slots = C_Container.GetContainerNumSlots(tabID)
                for slot = 1, slots do
                    local itemInfo = C_Container.GetContainerItemInfo(tabID, slot)
                    if itemInfo and itemInfo.itemID and itemInfo.stackCount then
                        data[tostring(itemInfo.itemID)] = (data[tostring(itemInfo.itemID)] or 0) + itemInfo.stackCount
                    end
                end
            end
        end
    end
    return data
end

-- HAUPTFUNKTION ZUM SPEICHERN
local function SaveAllData(isInitialBoot)
    if not BankSnapshotDB then return end

    local charName = UnitName("player")
    local realmName = GetRealmName()
    if not charName or not realmName then return end

    -- Grundstrukturen absichern
    if not BankSnapshotDB.realms then BankSnapshotDB.realms = {} end
    if not BankSnapshotDB.warband then BankSnapshotDB.warband = {} end
    if not BankSnapshotDB.names then BankSnapshotDB.names = {} end
    if not BankSnapshotDB.warbandGold then BankSnapshotDB.warbandGold = 0 end 
    if not BankSnapshotDB.realms[realmName] then BankSnapshotDB.realms[realmName] = {} end
    
    local oldGold = 0
    if BankSnapshotDB.realms[realmName][charName] and BankSnapshotDB.realms[realmName][charName].gold then
        oldGold = BankSnapshotDB.realms[realmName][charName].gold
    end

    -- Erweitert um den soulbound Block
    if not BankSnapshotDB.realms[realmName][charName] then 
        BankSnapshotDB.realms[realmName][charName] = { 
            gold = 0,
            bags = {}, 
            bank = {},
            soulbound = {}
        } 
    end

    -- Gold berechnen
    local currentGold = GetMoney()
    if currentGold == 0 and oldGold > 0 then
        BankSnapshotDB.realms[realmName][charName].gold = oldGold
    else
        if not (currentGold == 0 and isInitialBoot) then
            BankSnapshotDB.realms[realmName][charName].gold = currentGold
        end
    end

    -- Kriegsmeilen-Bank Gold
    if C_Bank and C_Bank.FetchDepositedMoney then
        local currentWarbandGold = C_Bank.FetchDepositedMoney(Enum.BankType.Account)
        local oldWarbandGold = BankSnapshotDB.warbandGold or 0
        if currentWarbandGold == 0 and oldWarbandGold > 0 then
            BankSnapshotDB.warbandGold = oldWarbandGold
        else
            if not (currentWarbandGold == 0 and isInitialBoot) then
                BankSnapshotDB.warbandGold = currentWarbandGold
            end
        end
    end

    -- Inventar scannen und Daten aufteilen
    local freshBags, freshBank, freshSoulbound = ScanCharacterInventory()

    -- Taschen & Soulbound werden immer überschrieben (da immer verfügbar)
    BankSnapshotDB.realms[realmName][charName].bags = freshBags
    BankSnapshotDB.realms[realmName][charName].soulbound = freshSoulbound

    -- Bank wird nur aktualisiert, wenn sie wirklich offen ist
    if isBankOpen then
        BankSnapshotDB.realms[realmName][charName].bank = freshBank
        local freshWarband = ScanWarbandBankOnly()
        if freshWarband and next(freshWarband) ~= nil then
            BankSnapshotDB.warband = freshWarband
        end
    end

    -- Namen-Cache befüllen
    local function CacheNames(targetTable)
        if not targetTable then return end
        for itemIDStr, _ in pairs(targetTable) do
            local itemID = tonumber(itemIDStr)
            if itemID and C_Item and C_Item.GetItemNameByID then
                local name = C_Item.GetItemNameByID(itemID)
                if name then BankSnapshotDB.names[itemIDStr] = name end
            end
        end
    end

    CacheNames(BankSnapshotDB.realms[realmName][charName].bags)
    CacheNames(BankSnapshotDB.realms[realmName][charName].bank)
    CacheNames(BankSnapshotDB.realms[realmName][charName].soulbound)
    CacheNames(BankSnapshotDB.warband)
end

-- EVENT-STEUERUNG
frame:SetScript("OnEvent", function(self, event, arg1)
    if event == "ADDON_LOADED" and arg1 == addonName then
        if not BankSnapshotDB then
            BankSnapshotDB = { realms = {}, warband = {}, names = {}, warbandGold = 0 }
        end
        SaveAllData(true)
    elseif event == "PLAYER_LOGIN" then
        SaveAllData(false)
    elseif event == "BANKFRAME_OPENED" then
        isBankOpen = true
        SaveAllData(false)
    elseif event == "BANKFRAME_CLOSED" then
        SaveAllData(false)
        isBankOpen = false
    elseif event == "PLAYERBANKSLOTS_CHANGED" or event == "ACCOUNT_MONEY" then
        SaveAllData(false)
    elseif event == "PLAYER_LOGOUT" then
        SaveAllData(false)
    end
end)