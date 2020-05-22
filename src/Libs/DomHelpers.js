export function fillSelectOptionsFromArray(selectElement, optionsArray, keyForOptionText, keyForOptionValue) {
    selectElement.innerHTML = ''

    optionsArray.forEach(item => {
        let option = document.createElement('option')
        option.innerHTML = item[keyForOptionText]
        option.value = item[keyForOptionValue]
        selectElement.appendChild(option)
    })
}
