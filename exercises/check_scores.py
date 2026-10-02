def check_scores(scores):
    counter = 0

    for score in scores:
        if score >= 10:
            counter += 1

    if counter >= 3:
        print("Class was successful")
    else:
        print("Class needs practice")

    return counter


student_scores = [12, 8, 15, 9, 18, 7]
passed = check_scores(student_scores)
result = passed * 2
print("Passed:", passed)
print("Final result:", result)
